# 9Router 完整使用手册

**版本: 0.4.39**  
**最后更新: 2026-05-14**

---

## 目录

1. [产品概述](#1-产品概述)
2. [安装与部署](#2-安装与部署)
3. [控制面板使用指南](#3-控制面板使用指南)
4. [提供商连接与管理](#4-提供商连接与管理)
5. [模型组合(Combos)](#5-模型组合combos)
6. [CLI工具集成](#6-cli工具集成)
7. [使用统计与监控](#7-使用统计与监控)
8. [高级功能](#8-高级功能)
9. [故障排除](#9-故障排除)
10. [API参考](#10-api参考)
11. [环境变量配置](#11-环境变量配置)
12. [安全最佳实践](#12-安全最佳实践)

---

## 1. 产品概述

### 1.1 什么是9Router？

9Router是一款本地AI模型路由网关和控制面板，为开发者提供智能的多提供商路由、自动回退和成本优化功能。

### 1.2 核心价值主张

- **Token节省**: 通过RTK技术每次请求节省20-40%的tokens
- **智能切换**: 订阅→低价→免费，自动无缝切换
- **多工具兼容**: 支持所有主流AI编程工具
- **实时监控**: 配额追踪、成本分析、支出报告
- **灵活部署**: 支持本地、VPS、Docker等多种部署方式

### 1.3 支持的提供商类型

#### 1.3.1 OAuth订阅型提供商

| 提供商 | 前缀 | 说明 |
|--------|------|------|
| Claude Code | `cc/` | Pro/Max订阅 |
| OpenAI Codex | `cx/` | Plus/Pro订阅 |
| GitHub Copilot | `gh/` | 月度订阅 |
| Cursor IDE | `cu/` | Cursor订阅 |
| Gemini CLI | `gc/` | 每月180K免费额度 |

#### 1.3.2 API Key型低价提供商

| 提供商 | 前缀 | 价格 | 重置周期 |
|--------|------|------|----------|
| GLM | `glm/` | $0.6/1M | 每日10:00 AM |
| MiniMax | `minimax/` | $0.2/1M | 5小时滚动 |
| Kimi | `kimi/` | $9/月固定 | 每月 |

#### 1.3.3 免费提供商

| 提供商 | 前缀 | 认证方式 | 说明 |
|--------|------|----------|------|
| Kiro AI | `kr/` | AWS Builder ID/GitHub/Google | Claude 4.5+无限量 |
| OpenCode Free | `oc/` | 无需认证 | 自动获取模型 |
| Vertex AI | `vertex/` | GCP服务账户 | $300免费额度(90天) |

---

## 2. 安装与部署

### 2.1 系统要求

- **Node.js**: 20.0或更高版本
- **操作系统**: Windows、macOS、Linux
- **网络**: 能够访问AI提供商API
- **端口**: 20128（默认）

### 2.2 本地安装（从源码）

```bash
# 克隆仓库
git clone https://github.com/decolua/9router.git
cd 9router

# 安装依赖
npm install

# 复制环境配置文件
cp .env.example .env

# 启动开发服务器
npm run dev
```

### 2.3 Docker部署

```bash
# 构建镜像
docker build -t 9router .

# 运行容器
docker run -d \
  --name 9router \
  -p 20128:20128 \
  --env-file .env \
  -v 9router-data:/app/data \
  -v 9router-usage:/root/.9router \
  9router
```

### 2.4 生产环境部署

```bash
# 构建生产版本
npm run build

# 使用环境变量启动
JWT_SECRET=your-secure-secret \
INITIAL_PASSWORD=your-password \
DATA_DIR=/var/lib/9router \
PORT=20128 \
NODE_ENV=production \
npm run start
```

### 2.5 访问控制面板

- **本地访问**: http://localhost:20128
- **网络访问**: http://<IP地址>:20128
- **默认密码**: 123456（首次登录后请立即修改）

---

## 3. 控制面板使用指南

### 3.1 登录与认证

#### 3.1.1 首次登录

1. 访问 http://localhost:20128
2. 输入默认密码: `123456`
3. 进入控制面板后建议立即修改密码

#### 3.1.2 修改密码

```
控制面板 → 设置 → 安全 → 修改密码
```

#### 3.1.3 OIDC认证配置（可选）

如需使用企业SSO：

```
控制面板 → 设置 → 认证模式 → OIDC
- 配置Issuer URL
- 配置Client ID和Client Secret
- 设置Scopes
```

### 3.2 主界面导航

| 功能区 | 说明 |
|--------|------|
| **仪表盘** | 使用概览、配额状态、最近活动 |
| **提供商** | AI提供商连接与管理 |
| **组合** | 创建和管理模型组合 |
| **API密钥** | 生成和管理访问密钥 |
| **使用统计** | Token消耗、成本分析 |
| **设置** | 系统配置和偏好设置 |

### 3.3 端点配置

#### 3.3.1 RTK Token节省器

RTK（Rust Token Kit）可自动压缩工具输出内容：

- **适用内容**: git diff、grep、ls、tree、日志等
- **节省比例**: 20-40%输入tokens
- **启用方式**: 控制面板 → 端点设置 → RTK Token节省器

#### 3.3.2 Caveman模式

注入简洁提示词，减少输出tokens：

- **节省比例**: 高达65%输出tokens
- **适用场景**: 需要精简回复的任务
- **启用方式**: 控制面板 → 端点设置 → Caveman模式

#### 3.3.3 模型别名

创建模型别名简化调用：

```
控制面板 → 端点设置 → 模型别名 → 新建
示例:
  别名: claude-opus
  目标: cc/claude-opus-4-7
```

---

## 4. 提供商连接与管理

### 4.1 OAuth提供商连接

#### 4.1.1 Claude Code

1. **连接步骤**:
   ```
   控制面板 → 提供商 → Claude Code → 连接
   → 使用Anthropic账户登录
   → 授权9Router访问
   → 完成OAuth流程
   ```

2. **支持的模型**:
   - `cc/claude-opus-4-7`
   - `cc/claude-opus-4-6`
   - `cc/claude-sonnet-4-6`
   - `cc/claude-sonnet-4-5-20250929`
   - `cc/claude-haiku-4-5-20251001`

3. **配额特点**:
   - 5小时滚动配额
   - 每周重置配额
   - 自动token刷新

#### 4.1.2 OpenAI Codex

1. **连接步骤**:
   ```
   控制面板 → 提供商 → Codex → 连接
   → 使用OpenAI账户登录（端口1455）
   → 授权访问
   ```

2. **支持的模型**:
   - `cx/gpt-5.5`
   - `cx/gpt-5.4`
   - `cx/gpt-5.3-codex`
   - `cx/gpt-5.2-codex`

#### 4.1.3 GitHub Copilot

1. **连接步骤**:
   ```
   控制面板 → 提供商 → GitHub Copilot → 连接
   → GitHub OAuth授权
   ```

2. **支持的模型**:
   - `gh/gpt-5.4`
   - `gh/claude-opus-4.7`
   - `gh/claude-sonnet-4.6`
   - `gh/gemini-3.1-pro-preview`

#### 4.1.4 Cursor IDE

1. **连接步骤**:
   ```
   控制面板 → 提供商 → Cursor → 连接
   → Cursor OAuth登录
   ```

2. **支持的模型**:
   - `cu/claude-4.6-opus-max`
   - `cu/claude-4.5-sonnet-thinking`
   - `cu/gpt-5.3-codex`

### 4.2 API Key提供商配置

#### 4.2.1 GLM配置

1. **注册Zhipu AI**:
   - 访问 https://open.bigmodel.cn/
   - 注册账户并完成实名认证
   - 订阅编程计划获取API Key

2. **控制面板配置**:
   ```
   控制面板 → 提供商 → 添加API Key
   → 选择提供商: GLM
   → 粘贴API Key
   → 保存
   ```

3. **支持的模型**:
   - `glm/glm-5.1`
   - `glm/glm-5`
   - `glm/glm-4.7`

4. **价格信息**:
   - 输入: $0.6/1M tokens
   - 输出: $2.2/1M tokens
   - 每日10:00 AM重置配额

#### 4.2.2 MiniMax配置

1. **注册MiniMax**:
   - 访问 https://www.minimax.io/
   - 注册并获取API Key

2. **支持的模型**:
   - `minimax/MiniMax-M2.7`
   - `minimax/MiniMax-M2.5`

3. **价格信息**:
   - 输入: $0.2/1M tokens
   - 输出: $1.0/1M tokens
   - 5小时滚动配额

#### 4.2.3 Kimi配置

1. **注册Moonshot AI**:
   - 访问 https://platform.moonshot.ai/
   - 订阅并获取API Key

2. **支持的模型**:
   - `kimi/kimi-k2.5`
   - `kimi/kimi-k2.5-thinking`

3. **价格信息**:
   - 固定费用: $9/月
   - 包含: 10M tokens
   - 实际成本: $0.90/1M tokens

### 4.3 免费提供商连接

#### 4.3.1 Kiro AI（推荐）

1. **特点**:
   - 真正免费无限量
   - 支持Claude 4.5、GLM-5、MiniMax
   - 无需API Key

2. **连接步骤**:
   ```
   控制面板 → 提供商 → Kiro AI → 连接
   → 选择认证方式（AWS Builder ID/GitHub/Google）
   → 完成OAuth授权
   ```

3. **支持的模型**:
   - `kr/claude-sonnet-4.5`
   - `kr/claude-haiku-4.5`
   - `kr/glm-5`
   - `kr/MiniMax-M2.5`
   - `kr/qwen3-coder-next`
   - `kr/deepseek-3.2`

#### 4.3.2 OpenCode Free

1. **特点**:
   - 无需注册
   - 直连代理
   - 自动获取可用模型

2. **连接步骤**:
   ```
   控制面板 → 提供商 → OpenCode Free → 连接
   → 无需任何认证
   ```

3. **使用方式**:
   - 使用前缀 `oc/<auto>` 自动选择模型
   - 或指定模型: `oc/<具体模型名>`

#### 4.3.3 Vertex AI

1. **前置要求**:
   - Google Cloud账户
   - 服务账户JSON密钥文件
   - 在GCP中启用Vertex AI API

2. **连接步骤**:
   ```
   控制面板 → 提供商 → Vertex AI → 连接
   → 上传GCP服务账户JSON
   → 等待验证完成
   ```

3. **免费额度**:
   - $300免费额度（90天有效）
   - 适用Gemini 3 Pro、DeepSeek、GLM-5等

4. **支持的模型**:
   - `vertex/gemini-3.1-pro-preview`
   - `vertex/gemini-3-flash-preview`
   - `vertex/gemini-2.5-flash`
   - `vertex-partner/glm-5-maas`
   - `vertex-partner/deepseek-v3.2-maas`

### 4.4 提供商管理

#### 4.4.1 多账户支持

为同一提供商添加多个账户：

```
控制面板 → 提供商 → [提供商名称] → 添加账户
→ 输入账户信息
→ 设置优先级
```

**优先级策略**:
- **轮询**: 均匀分配请求到多个账户
- **主备**: 优先使用主账户，失败后切换到备份

#### 4.4.2 提供商状态监控

| 状态 | 含义 |
|------|------|
| 🟢 活跃 | 正常运行，可接受请求 |
| 🟡 冷却中 | 临时不可用，等待恢复 |
| 🔴 离线 | 认证过期或被禁用 |
| ⚠️ 配额耗尽 | 当前配额已用完 |

#### 4.4.3 提供商测试

测试提供商连接是否正常：

```
控制面板 → 提供商 → [提供商] → 测试
→ 查看测试结果
→ 诊断连接问题
```

---

## 5. 模型组合(Combos)

### 5.1 什么是模型组合？

模型组合是定义多个模型顺序尝试的自定义回退链。当前一个模型不可用、配额耗尽或出错时，自动切换到下一个模型。

### 5.2 创建组合

#### 5.2.1 基本步骤

1. **打开组合页面**:
   ```
   控制面板 → 组合 → 新建组合
   ```

2. **配置组合信息**:
   ```
   组合名称: premium-coding
   描述: 订阅优先，低价备用，免费应急
   ```

3. **添加模型**:
   ```
   按优先级顺序添加模型:
   1. cc/claude-opus-4-7 (首选)
   2. glm/glm-5.1 (低价备用)
   3. minimax/MiniMax-M2.7 (超低价)
   4. kr/claude-sonnet-4.5 (免费应急)
   ```

4. **保存组合**:
   ```
   点击"保存"
   → 组合出现在模型列表中
   ```

#### 5.2.2 模型排序

拖动模型卡片可调整优先级：

```
↑ 向上移动（更高优先级）
↓ 向下移动（更低优先级）
```

### 5.3 组合使用示例

#### 5.3.1 示例1：充分利用订阅

```
名称: premium-coding
模型:
  1. cc/claude-opus-4-7
  2. glm/glm-5.1
  3. kr/claude-sonnet-4.5
```

**使用场景**: 已有Claude Pro订阅，想充分利用

**工作原理**:
- 优先使用Claude订阅
- 订阅配额用完→自动切换到GLM
- GLM也耗尽→使用Kiro免费模型

#### 5.3.2 示例2：零成本方案

```
名称: free-forever
模型:
  1. kr/claude-sonnet-4.5
  2. kr/glm-5
  3. oc/<auto>
```

**使用场景**: 不想花任何钱的用户

**工作原理**:
- 完全使用免费提供商
- Kiro的Claude 4.5质量优秀
- OpenCode作为最后备选

#### 5.3.3 示例3：成本优化

```
名称: cost-optimized
模型:
  1. glm/glm-5.1
  2. minimax/MiniMax-M2.7
  3. if/kimi-k2-thinking
```

**使用场景**: 需要便宜但可靠的方案

**成本估算**:
- 100M tokens约需$46
- 相比ChatGPT API($2000)节省97%

### 5.4 组合高级配置

#### 5.4.1 预算上限

为组合设置成本限制：

```
组合设置 → 预算上限
- 每日上限: $5
- 每月上限: $50
```

**效果**: 达到上限后跳过付费模型，仅使用免费层

#### 5.4.2 临时禁用模型

不删除模型，只暂时跳过：

```
组合编辑 → 模型列表
→ 取消勾选要禁用的模型
→ 保存
```

#### 5.4.3 克隆组合

快速创建已有组合的变体：

```
组合列表 → 克隆 → [组合名-copy]
→ 修改后保存为新组合
```

### 5.5 在CLI工具中使用组合

直接使用组合名称作为模型名：

```
Cursor IDE:
  Model: premium-coding

Claude Desktop:
  model: "free-forever"

Codex CLI:
  codex --model cost-optimized "your prompt"

API请求:
  {
    "model": "premium-coding",
    "messages": [...]
  }
```

---

## 6. CLI工具集成

### 6.1 Cursor IDE

#### 6.1.1 配置步骤

1. 打开Cursor设置
2. 进入 Models → Advanced
3. 配置参数:
   ```
   OpenAI API Base URL: http://localhost:20128/v1
   OpenAI API Key: [从控制面板获取]
   Model: cc/claude-opus-4-7
   ```

#### 6.1.2 使用组合

在Model字段直接输入组合名称：
```
Model: premium-coding
```

### 6.2 Claude Code

#### 6.2.1 配置文件位置

- **Linux/macOS**: `~/.claude/config.json`
- **Windows**: `%USERPROFILE%/.claude/config.json`

#### 6.2.2 配置示例

```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-9router-api-key"
}
```

#### 6.2.3 指定模型

```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-9router-api-key",
  "model": "cc/claude-opus-4-7"
}
```

### 6.3 Codex CLI

#### 6.3.1 环境变量配置

```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-9router-api-key"
```

#### 6.3.2 使用示例

```bash
# 使用默认模型
codex "Explain this code"

# 指定模型或组合
codex --model cc/claude-opus-4-7 "Explain this code"
codex --model premium-coding "Explain this code"
```

### 6.4 Cline / Continue / RooCode

#### 6.4.1 配置步骤

1. 进入工具设置
2. 选择Provider: OpenAI Compatible
3. 配置:
   ```
   Base URL: http://localhost:20128/v1
   API Key: [从控制面板获取]
   Model: cc/claude-opus-4-7
   ```

### 6.5 OpenClaw

#### 6.5.1 控制面板配置（推荐）

```
控制面板 → CLI工具 → OpenClaw
→ 选择模型或组合
→ 点击"应用配置"
```

#### 6.5.2 手动配置

编辑配置文件 `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "9router/kr/claude-sonnet-4.5"
      }
    }
  },
  "models": {
    "providers": {
      "9router": {
        "baseUrl": "http://127.0.0.1:20128/v1",
        "apiKey": "sk_9router",
        "api": "openai-completions",
        "models": [
          {
            "id": "kr/claude-sonnet-4.5",
            "name": "Claude Sonnet 4.5 (Kiro Free)"
          }
        ]
      }
    }
  }
}
```

**注意**: OpenClaw仅适用于本地9Router，使用`127.0.0.1`而非`localhost`

### 6.6 Gemini CLI

#### 6.6.1 环境变量配置

```bash
export GEMINI_API_KEY="your-9router-api-key"
export GEMINI_BASE_URL="http://localhost:20128/v1"
```

### 6.7 自定义API客户端

#### 6.7.1 OpenAI SDK示例

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:20128/v1",
    api_key="your-9router-api-key"
)

response = client.chat.completions.create(
    model="cc/claude-opus-4-7",
    messages=[
        {"role": "user", "content": "Hello, world!"}
    ]
)
```

#### 6.7.2 cURL示例

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer your-9router-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cc/claude-opus-4-7",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ],
    "stream": true
  }'
```

---

## 7. 使用统计与监控

### 7.1 实时配额追踪

#### 7.1.1 配额状态面板

```
控制面板 → 仪表盘 → 配额状态
```

显示内容：
- 每个提供商的当前token消耗
- 配额重置倒计时
- 付费层级成本估算

#### 7.1.2 配额重置时间表

| 提供商 | 重置类型 | 重置时间 |
|--------|----------|----------|
| Claude Code | 5小时+每周 | 滚动 |
| Codex | 5小时+每周 | 滚动 |
| GLM | 每日 | 10:00 AM |
| MiniMax | 5小时 | 滚动 |
| Gemini CLI | 每日 | 午夜 |

### 7.2 使用分析

#### 7.2.1 成本追踪

```
控制面板 → 使用统计 → 成本分析
```

功能：
- 按提供商分解成本
- 按时间段统计
- 月度支出报告
- 节省估算

**重要说明**:
显示的成本是**估算值**，仅用于追踪和比较目的，不代表实际扣款。9Router本身不收取任何费用。

#### 7.2.2 Token使用详情

```
控制面板 → 使用统计 → Token详情
```

显示：
- prompt tokens消耗
- completion tokens消耗
- 各模型使用比例
- 请求数量统计

### 7.3 请求日志

#### 7.3.1 启用请求日志

设置环境变量：
```bash
ENABLE_REQUEST_LOGS=true
```

日志文件位置：
```
<repo>/logs/request-YYYY-MM-DD.json
```

#### 7.3.2 日志内容

每条请求日志包含：
- 请求时间戳
- 使用的模型
- prompt tokens
- completion tokens
- 响应状态
- 错误信息（如有）

### 7.4 调试模式

启用详细调试信息：

```
控制面板 → 设置 → 调试模式 → 开启
```

**注意**: 调试模式会产生大量日志，仅在排查问题时启用。

---

## 8. 高级功能

### 8.1 云同步

#### 8.1.1 启用云同步

```
控制面板 → 端点设置 → 云同步 → 启用
→ 绑定9Router账户
→ 选择同步内容
```

#### 8.1.2 同步内容

- 提供商连接
- 模型组合
- API密钥
- 使用设置

#### 8.1.3 多设备同步

启用后，在其他设备登录同一账户即可同步配置。

### 8.2 代理配置

#### 8.2.1 出站代理

如需通过代理访问AI提供商：

```bash
# HTTP代理
HTTP_PROXY=http://127.0.0.1:7890

# HTTPS代理
HTTPS_PROXY=http://127.0.0.1:7890

# SOCKS代理
ALL_PROXY=socks5://127.0.0.1:1080

# 排除列表
NO_PROXY=localhost,127.0.0.1
```

#### 8.2.2 代理池

创建多个代理IP轮换使用：

```
控制面板 → 代理池 → 新建
→ 添加代理URL
→ 设置测试间隔
→ 启用自动切换
```

### 8.3 自定义提供商

#### 8.3.1 添加兼容节点

```
控制面板 → 提供商 → 自定义节点 → 添加
→ 配置端点URL
→ 选择API类型（OpenAI/Anthropic）
→ 设置认证方式
```

#### 8.3.2 配置示例

**OpenAI兼容端点**:
```
名称: My-Custom-Provider
API类型: OpenAI Compatible
Base URL: https://api.example.com/v1
Auth方式: Bearer Token
Header: Authorization: Bearer your-token
```

**Anthropic兼容端点**:
```
名称: My-Claude-Proxy
API类型: Anthropic Compatible
Base URL: https://proxy.example.com
Auth方式: API Key in Header
Header: x-api-key: your-key
```

### 8.4 MITM代理（高级）

9Router支持MITM（中间人）代理模式，可以拦截和分析HTTPS流量。

#### 8.4.1 启用MITM

```
控制面板 → 高级 → MITM代理 → 启用
→ 生成自签名证书
→ 安装证书到系统
```

#### 8.4.2 证书安装

**Windows**:
1. 下载证书
2. 双击打开
3. 选择"本地计算机"
4. 将证书放入"受信任的根证书颁发机构"

#### 8.4.3 使用限制

MITM模式主要用于开发调试，生产环境建议使用标准模式。

### 8.5 DNS配置（高级）

自定义DNS设置以优化路由：

```
控制面板 → 高级 → DNS设置
→ 添加自定义域名解析
→ 配置DNS覆盖规则
```

### 8.6 Webhooks

配置事件通知：

```
控制面板 → 高级 → Webhooks → 添加
→ 设置回调URL
→ 选择触发事件
→ 配置重试策略
```

#### 8.6.1 支持的事件

- `quota.exhausted` - 配额耗尽
- `combo.fallback` - 发生回退
- `provider.error` - 提供商错误
- `sync.completed` - 同步完成

---

## 9. 故障排除

### 9.1 常见问题

#### 9.1.1 "语言模型未提供消息"

**原因**: 提供商配额耗尽或认证失败

**解决方案**:
1. 检查控制面板配额状态
2. 确认提供商连接状态
3. 使用组合切换到备用模型

#### 9.1.2 速率限制

**原因**: 订阅配额用完

**解决方案**:
1. 等待配额重置
2. 使用低价备用模型（GLM、MiniMax）
3. 使用免费模型（Kiro、OpenCode Free）

#### 9.1.3 OAuth认证失败

**原因**: Token过期或权限不足

**解决方案**:
1. 控制面板 → 提供商 → 重新连接
2. 清除浏览器缓存后重试
3. 检查提供商服务状态

#### 9.1.4 连接超时

**原因**: 网络问题或提供商服务器故障

**解决方案**:
1. 检查本地网络连接
2. 使用代理（如需要）
3. 切换到其他提供商
4. 查看提供商状态页面

#### 9.1.5 成本显示异常高

**原因**: 误解成本显示含义

**说明**: 
控制面板显示的成本是**估算值**，不代表实际扣款。使用免费提供商时，实际成本为$0。

### 9.2 日志分析

#### 9.2.1 查看应用日志

```bash
# Docker环境
docker logs -f 9router

# 本地环境
tail -f ~/.9router/log.txt
```

#### 9.2.2 请求日志调试

```bash
# 启用详细日志
ENABLE_REQUEST_LOGS=true

# 查看请求日志
cat logs/request-YYYY-MM-DD.json | jq
```

### 9.3 重置操作

#### 9.3.1 重置提供商配额缓存

```
控制面板 → 提供商 → [提供商] → 重置配额
```

#### 9.3.2 清除所有连接

```
控制面板 → 设置 → 高级 → 清除所有连接
```

#### 9.3.3 恢复出厂设置

**警告**: 此操作会删除所有配置

```bash
# 停止服务
# 删除数据文件
rm -rf ~/.9router/db.json
rm -rf ~/.9router/usage.json

# 重启服务
npm run dev
```

---

## 10. API参考

### 10.1 API端点概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天补全 |
| `/v1/models` | GET | 列出可用模型 |
| `/v1/embeddings` | POST | 向量嵌入 |
| `/v1/images/generations` | POST | 图像生成 |
| `/v1/audio/speech` | POST | 文本转语音 |
| `/v1/audio/transcriptions` | POST | 语音转文字 |

### 10.2 聊天补全API

#### 10.2.1 请求格式

```bash
POST http://localhost:20128/v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "cc/claude-opus-4-7",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### 10.2.2 响应格式

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "cc/claude-opus-4-7",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 30,
    "total_tokens": 50
  }
}
```

#### 10.2.3 流式响应

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cc/claude-opus-4-7",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

流式响应格式：
```
data: {"id":"xxx","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"xxx","choices":[{"delta":{"content":"!"}}]}

data: [DONE]
```

### 10.3 模型列表API

#### 10.3.1 请求

```bash
GET http://localhost:20128/v1/models
Authorization: Bearer your-api-key
```

#### 10.3.2 响应

```json
{
  "object": "list",
  "data": [
    {
      "id": "cc/claude-opus-4-7",
      "object": "model",
      "created": 1234567890,
      "owned_by": "anthropic",
      "provider": "claude-code"
    },
    {
      "id": "premium-coding",
      "object": "combo",
      "models": [
        "cc/claude-opus-4-7",
        "glm/glm-5.1",
        "kr/claude-sonnet-4.5"
      ]
    }
  ]
}
```

### 10.4 向量嵌入API

```bash
POST http://localhost:20128/v1/embeddings
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "text-embedding-3-small",
  "input": "The quick brown fox jumps over the lazy dog"
}
```

### 10.5 图像生成API

```bash
POST http://localhost:20128/v1/images/generations
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "dall-e-3",
  "prompt": "A cute baby sea otter",
  "n": 1,
  "size": "1024x1024"
}
```

### 10.6 文本转语音API

```bash
POST http://localhost:20128/v1/audio/speech
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "tts-1",
  "input": "Hello world!",
  "voice": "alloy"
}
```

**注意**: 返回音频二进制流（MP3格式）

### 10.7 语音转文字API

```bash
POST http://localhost:20128/v1/audio/transcriptions
Authorization: Bearer your-api-key
Content-Type: multipart/form-data

file: [音频文件]
model: whisper-1
```

### 10.8 错误响应格式

```json
{
  "error": {
    "message": "Provider quota exhausted",
    "type": "rate_limit_error",
    "code": "quota_exhausted",
    "provider": "claude-code",
    "retry_after": 3600
  }
}
```

### 10.9 错误码说明

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `quota_exhausted` | 配额耗尽 | 等待重置或使用备用模型 |
| `rate_limit` | 请求频率超限 | 降低请求频率 |
| `auth_failed` | 认证失败 | 检查API Key或重新授权 |
| `invalid_model` | 模型不可用 | 检查模型名称 |
| `provider_error` | 提供商服务器错误 | 稍后重试 |
| `network_error` | 网络连接失败 | 检查网络或配置代理 |

---

## 11. 环境变量配置

### 11.1 必需变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | 9router-default-secret | JWT签名密钥（生产必改） |
| `INITIAL_PASSWORD` | 123456 | 首次登录密码 |
| `DATA_DIR` | ~/.9router | 数据存储目录 |

### 11.2 应用配置变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 20128 | 服务端口 |
| `HOSTNAME` | 0.0.0.0 | 绑定主机 |
| `NODE_ENV` | development | 运行环境 |

### 11.3 云同步变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | http://localhost:20128 | 服务端内部基础URL |
| `CLOUD_URL` | https://9router.com | 云同步端点 |
| `NEXT_PUBLIC_BASE_URL` | http://localhost:20128 | 公开基础URL |
| `NEXT_PUBLIC_CLOUD_URL` | https://9router.com | 公开云URL |

### 11.4 安全变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_KEY_SECRET` | endpoint-proxy-api-key-secret | API Key HMAC密钥 |
| `MACHINE_ID_SALT` | endpoint-proxy-salt | 机器ID盐值 |
| `AUTH_COOKIE_SECURE` | false | 强制Secure Cookie |
| `REQUIRE_API_KEY` | false | 强制API Key认证 |

### 11.5 代理变量

| 变量 | 说明 |
|------|------|
| `HTTP_PROXY` | HTTP代理地址 |
| `HTTPS_PROXY` | HTTPS代理地址 |
| `ALL_PROXY` | SOCKS代理地址 |
| `NO_PROXY` | 排除代理的地址 |

### 11.6 调试变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ENABLE_REQUEST_LOGS` | false | 启用请求日志 |
| `OBSERVABILITY_ENABLED` | true | 启用可观测性 |

### 11.7 配置示例

```bash
# 生产环境配置
JWT_SECRET=your-very-long-random-secret-here
INITIAL_PASSWORD=your-secure-password
DATA_DIR=/var/lib/9router
PORT=20128
HOSTNAME=0.0.0.0
NODE_ENV=production
BASE_URL=http://your-domain.com
CLOUD_URL=https://9router.com
API_KEY_SECRET=your-api-key-secret
MACHINE_ID_SALT=your-machine-salt
AUTH_COOKIE_SECURE=true
REQUIRE_API_KEY=true

# 可选代理配置
# HTTP_PROXY=http://127.0.0.1:7890
# HTTPS_PROXY=http://127.0.0.1:7890
```

---

## 12. 安全最佳实践

### 12.1 密码安全

1. **首次部署必改密码**: 默认密码123456必须在首次登录后立即修改
2. **使用强密码**: 至少16位，包含大小写字母、数字和特殊字符
3. **定期更换**: 建议每3个月更换一次密码

### 12.2 API Key保护

1. **妥善保管**: API Key相当于访问凭证，切勿泄露
2. **定期轮换**: 定期生成新的API Key并废弃旧的
3. **环境变量存储**: 生产环境通过环境变量传递，不写入代码

### 12.3 JWT Secret管理

1. **必改默认值**: 生产环境必须使用随机生成的强密钥
2. **足够长度**: 建议至少64字符的随机字符串
3. **安全存储**: 使用密钥管理服务（如AWS Secrets Manager）

### 12.4 网络安全

1. **HTTPS强制**: 面向互联网部署时启用`AUTH_COOKIE_SECURE=true`
2. **API Key认证**: 面向互联网部署时启用`REQUIRE_API_KEY=true`
3. **防火墙规则**: 仅允许受信任的IP访问管理面板
4. **代理配置**: 在受限制的网络环境中正确配置代理

### 12.5 数据保护

1. **定期备份**: 备份`db.json`和`usage.json`
2. **文件系统权限**: 确保数据目录仅管理员可访问
3. **敏感日志**: `ENABLE_REQUEST_LOGS`会产生敏感数据，确保日志目录安全

### 12.6 OAuth安全

1. **定期刷新**: OAuth token会自动刷新，但建议定期检查连接状态
2. **最小权限**: 仅授予必要的权限范围
3. **撤销授权**: 不再使用时及时在提供商处撤销授权

### 12.7 生产部署检查清单

- [ ] 修改默认密码
- [ ] 生成新的JWT_SECRET
- [ ] 设置API_KEY_SECRET
- [ ] 配置MACHINE_ID_SALT
- [ ] 启用AUTH_COOKIE_SECURE（使用HTTPS时）
- [ ] 启用REQUIRE_API_KEY（面向互联网时）
- [ ] 配置防火墙规则
- [ ] 设置定期备份
- [ ] 监控系统日志

---

## 附录A: 可用模型完整列表

### A.1 Claude Code（cc/）

```
cc/claude-opus-4-7
cc/claude-opus-4-6
cc/claude-sonnet-4-6
cc/claude-sonnet-4-5-20250929
cc/claude-haiku-4-5-20251001
```

### A.2 OpenAI Codex（cx/）

```
cx/gpt-5.5
cx/gpt-5.4
cx/gpt-5.3-codex
cx/gpt-5.2-codex
cx/gpt-5.1-codex-max
```

### A.3 GitHub Copilot（gh/）

```
gh/gpt-5.4
gh/claude-opus-4.7
gh/claude-sonnet-4.6
gh/gemini-3.1-pro-preview
gh/grok-code-fast-1
```

### A.4 Cursor IDE（cu/）

```
cu/claude-4.6-opus-max
cu/claude-4.5-sonnet-thinking
cu/gpt-5.3-codex
cu/kimi-k2.5
```

### A.5 Gemini CLI（gc/）

```
gc/gemini-3-flash-preview
gc/gemini-3-pro-preview
gc/gemini-2.5-pro
```

### A.6 GLM（glm/）

```
glm/glm-5.1
glm/glm-5
glm/glm-4.7
```

### A.7 MiniMax（minimax/）

```
minimax/MiniMax-M2.7
minimax/MiniMax-M2.5
```

### A.8 Kimi（kimi/）

```
kimi/kimi-k2.5
kimi/kimi-k2.5-thinking
```

### A.9 Kiro AI（kr/）

```
kr/claude-sonnet-4.5
kr/claude-haiku-4.5
kr/glm-5
kr/MiniMax-M2.5
kr/qwen3-coder-next
kr/deepseek-3.2
```

### A.10 OpenCode Free（oc/）

使用`oc/<auto>`自动选择，或手动指定模型

### A.11 Vertex AI（vertex/）

```
vertex/gemini-3.1-pro-preview
vertex/gemini-3-flash-preview
vertex/gemini-2.5-flash
vertex-partner/glm-5-maas
vertex-partner/deepseek-v3.2-maas
vertex-partner/qwen3-next-80b-a3b-thinking-maas
```

---

## 附录B: 技术栈

- **运行时**: Node.js 20+
- **框架**: Next.js 16
- **UI**: React 19 + Tailwind CSS 4
- **数据库**: SQLite + SQL.js（可选better-sqlite3）
- **流式传输**: Server-Sent Events (SSE)
- **认证**: OAuth 2.0 (PKCE) + JWT + API Keys

---

## 附录C: 支持资源

- **官方网站**: https://9router.com
- **GitHub仓库**: https://github.com/decolua/9router
- **问题反馈**: https://github.com/decolua/9router/issues
- **文档更新**: 欢迎提交Pull Request完善文档

---

<div align="center">
  <sub>用 ❤️ 为最大化AI价值的开发者打造</sub>
  <br/>
  <sub>9Router v0.4.39</sub>
</div>
