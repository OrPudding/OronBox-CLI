# OronBox-CLI

[English](./README.en.md) | 简体中文

OronBox 官方命令行工具（CLI），用于在计算机终端通过局域网连接 OronBox 客户端的本地 API 服务，检查并管理绑定的穿戴设备

## 架构角色

- **OronBox 客户端**：运行在移动设备或桌面上的 OronBox 主应用，开启【本地 API 服务】后作为局域网服务端（Server），负责与穿戴设备维持连接并调度命令
- **CLI（OronBox-CLI）**：运行在计算机终端的命令行客户端（Client），通过 RESTful 与 SSE 协议与 OronBox 客户端通信并执行控制指令

## 功能特性

- **服务发现**：基于 mDNS 自动发现局域网中运行的 OronBox 客户端
- **凭据认证**：基于 Ed25519 密钥对与 SHA-256 计算机指纹，OronBox 客户端界面实时审批授权
- **设备控制**：查询连接状态、硬件指标、电池电量与存储容量
- **诊断日志**：通过底层传输信道实时拉取穿戴设备系统诊断日志归档
- **应用与表盘**：支持第三方应用与表盘的安装、调起、切换与卸载
- **输出格式**：支持 ANSI 文本表格展示与 `--json` 结构化输出

## 安装

```bash
# 直接执行
npx oronbox-cli <command>

# 全局安装
npm install -g oronbox-cli
# 或
pnpm add -g oronbox-cli
```

## 快速上手

### 1. 发现与配对

确保 OronBox 客户端已开启【设置】->【高级设置】->【本地 API 服务】

```bash
# 自动扫描并配对
oronbox-cli pair

# 仅扫描局域网可用实例
oronbox-cli discover

# 指定 IP 与端口配对
oronbox-cli pair 192.168.1.100:10517
```

CLI 发起配对申请后，在 OronBox 客户端界面点击【允许】即可完成绑定

### 2. 查看状态

```bash
# 查看本地 API 服务运行状态与当前活动穿戴设备
oronbox-cli status

# 输出为 JSON 格式
oronbox-cli status --json
```

### 3. 管理穿戴设备与日志

```bash
# 列出 OronBox 客户端绑定的所有穿戴设备及连接状态
oronbox-cli device list

# 查看当前连接设备的硬件指标与电量详情
oronbox-cli device info

# 连接指定穿戴设备
oronbox-cli device connect <device_address>

# 断开当前穿戴设备
oronbox-cli device disconnect

# 实时拉取穿戴设备诊断日志归档（.tar.gz）
oronbox-cli device logs pull
```

### 4. 管理穿戴应用

```bash
# 列出穿戴设备已安装的第三方应用
oronbox-cli apps list

# 安装应用安装包（.rpk / .bin）
oronbox-cli apps install ./neomusic.release.rpk

# 在穿戴设备上拉起应用（可选指定页面路由）
oronbox-cli apps launch moe.orpu.neomusic page/music/index

# 卸载指定应用
oronbox-cli apps uninstall moe.orpu.neomusic
```

### 5. 管理表盘

```bash
# 查看已安装表盘列表
oronbox-cli watchfaces list

# 安装表盘安装包（.bin / .zip）
oronbox-cli watchfaces install ./watchface.bin

# 切换为当前活动表盘
oronbox-cli watchfaces set 120917345941

# 删除指定表盘
oronbox-cli watchfaces remove 120917345941
```

### 6. 管理授权计算机列表

```bash
# 列出 OronBox 客户端已授权的计算机
oronbox-cli clients list

# 吊销指定计算机的访问权限
oronbox-cli clients revoke <fingerprint>
```

## 文档索引

- [使用指南](./GUIDE.md) ([English](./GUIDE.en.md))：涵盖角色说明、环境准备、全局参数、各命令详解与自动化流程
- [API 规范](./API.md) ([English](./API.en.md))：包含局域网 RESTful / SSE 接口定义、Ed25519 签名流程及返回示例

## 全局选项

- `-H, --host <host>`：目标主机地址（默认：`127.0.0.1`，配对后自动记录）
- `-P, --port <port>`：目标服务端口（默认：`10517`，配对后自动记录）
- `--json`：以结构化 JSON 格式输出数据
- `-V, --version`：显示当前版本
- `-h, --help`：显示帮助信息

## 许可证

[Apache-2.0](./LICENSE)
