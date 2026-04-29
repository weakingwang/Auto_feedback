import axios from 'axios'
import fs from 'fs'
import path from 'path'

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_API_URL = process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen2.5-vl-72b-instruct'
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))

// AI提示词
const SYSTEM_PROMPT = `你是一个"用户反馈结构化分析器"。

你的任务不是总结，不是安抚用户，也不是生成客服回复。你的唯一任务是根据输入内容，输出一份严格可机读的 JSON，用于后端入库和统计分析。

有时系统还会附带 0 到 3 张用户上传的截图。这些截图属于辅助证据，你可以结合截图与文本一起判断；如果截图信息与文本冲突，以用户明确文字描述为主。不要从截图中臆造文本里没有表达的复杂业务背景。

输入一定是一个 JSON 对象，字段如下：

{\n  "problem_type": "cannot_use | cannot_understand | not_good_enough",\n  "issue_text": "用户填写的问题描述",\n  "context_text": "用户填写的补充上下文"\n}

字段含义：
- \`problem_type\`
  - \`cannot_use\`：功能不可用 / 报错
  - \`cannot_understand\`：下一步不知道如何进行
  - \`not_good_enough\`：最终效果不太好
- \`issue_text\`：用户对问题的主描述
- \`context_text\`：用户补充的当时行为、原本目标或期望结果

你必须输出且只能输出以下 JSON 结构：

{\n  "root_cause": "bug_error | usability_issue | ai_quality_issue | performance_issue | product_gap | other | unknown",\n  "feature_module": "model_switch | code_generate | editor | run_preview | claude_init | project_setup | unknown",\n  "user_intent": "create_project | generate_code | modify_code | run_project | fix_error | learn_usage | unknown",\n  "stage": "start_phase | input_phase | generation_phase | post_generation | run_phase | unknown",\n  "severity": "high | medium | low | unknown",\n  "confidence": 0.0,\n  "reason": "一句简短中文说明"\n}

强约束：
- 只输出 JSON 对象
- 不要输出 Markdown
- 不要输出代码块
- 不要输出任何解释性前后缀
- 所有字段必须返回
- 任何字段无法判断时，填 \`unknown\`
- 不允许输出枚举外的新值
- \`confidence\` 必须是 \`0\` 到 \`1\` 之间的数字
- \`reason\` 必须是一句简短中文，说明主要判断依据

判定原则：
- 只能基于输入中明确提供的信息判断
- 不要臆测用户没有提到的页面、按钮、功能或报错
- 如果多种解释都成立，选择最直接、最主要的一种
- \`root_cause\` 表示问题性质，不等于前端的 \`problem_type\`
- \`feature_module\` 表示问题主要落在哪个产品模块
- \`user_intent\` 表示用户原本最想完成的任务
- \`stage\` 表示问题最可能发生在哪个流程阶段
- \`severity\` 用业务影响判断，不用技术事故标准判断`

const resolveUploadImagePath = (imagePath) => {
  if (!imagePath) return null

  const normalized = String(imagePath)
  const candidates = []

  if (path.isAbsolute(normalized)) {
    candidates.push(normalized)
  } else {
    candidates.push(path.resolve(normalized))
  }

  candidates.push(path.resolve(UPLOAD_DIR, path.basename(normalized)))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

// 将图片转为 base64
const imageToBase64 = (imagePath) => {
  try {
    const filePath = resolveUploadImagePath(imagePath)
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`图片不存在: ${imagePath}`)
      return null
    }
    const imageBuffer = fs.readFileSync(filePath)
    const base64 = imageBuffer.toString('base64')
    const ext = path.extname(filePath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('图片转base64失败:', error)
    return null
  }
}

// 分析反馈
export const analyzeFeedback = async (feedback, imagePaths = []) => {
  try {
    const userContent = JSON.stringify({
      problem_type: feedback.problem_type,
      issue_text: feedback.issue_text,
      context_text: feedback.context_text || '',
      environment_info: feedback.environment_info || ''
    })

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ]

    // 如果有图片，转为base64并添加到消息中
    if (imagePaths.length > 0) {
      const imageContents = []
      for (const imgPath of imagePaths) {
        const base64Url = imageToBase64(imgPath)
        if (base64Url) {
          imageContents.push({
            type: 'image_url',
            image_url: { url: base64Url }
          })
        }
      }

      if (imageContents.length > 0) {
        messages[1].content = [
          { type: 'text', text: userContent },
          ...imageContents
        ]
      }
    }

    const response = await axios.post(
      `${DASHSCOPE_API_URL}/chat/completions`,
      {
        model: DASHSCOPE_MODEL,
        messages: messages,
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const content = response.data.choices[0].message.content

    // 解析JSON响应
    try {
      // 尝试直接解析
      const result = JSON.parse(content)
      return {
        success: true,
        data: result
      }
    } catch (e) {
      // 如果失败，尝试从文本中提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          success: true,
          data: result
        }
      }
      throw new Error('无法解析AI响应')
    }
  } catch (error) {
    console.error('AI分析失败:', error.message)
    if (error.response) {
      console.error('AI API错误:', error.response.data)
    }
    return {
      success: false,
      error: error.message
    }
  }
}

export default { analyzeFeedback }
