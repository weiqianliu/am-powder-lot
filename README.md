# 增材粉末批次复用追溯台

车间金属粉末批次追溯系统：批次登记、称重/筛分记录导入、按批次查看事件时间轴。
后端 TypeScript + Fastify + SQLite，前端 React + Vite，测试 Vitest，Docker Compose 一键起环境。

## 功能

1. **批次基础登记**：批次号、合金牌号、粒度档，登记时同时记录「新粉到货」事件（到货重量、时间、设备号可选）。
2. **导入称重/筛分记录**：CSV 文本导入，字段为 `批次号,事件类型,重量(g),设备号,事件时间`。
   - 任何一行有问题（格式错、批次未登记、与历史记录重复）→ **整批拒绝**，不入库任何一行，并逐行报告行号与原因。
   - 原始文件内容**原样留存**，可通过接口一字不差地取回。
3. **批次事件时间轴**：按批次号查询全部事件，**按事件时间排序**（不是文件行序），每条事件同时展示原始记录行与来源（哪次导入的第几行）。

## 数据安全约定

- `powder_events` 与 `imports` 两张表在数据库层面由触发器保护：**禁止 UPDATE / DELETE**，只允许追加，原始记录不许改写。
- 同一批次下「事件类型 + 重量 + 设备号 + 事件时间」完全一致的记录会被判重，防止重复导入。
- 无任何外部服务依赖；前端直接访问真实后端 API（开发环境经 Vite 代理，生产环境经 nginx 代理）。

## 快速开始（Docker）

```bash
docker compose up --build
```

- 前端：http://localhost:8080
- 后端 API：http://localhost:3001/api/health
- SQLite 数据落在名为 `server-data` 的卷里，容器重建不丢数据。

## 本地开发

```bash
# 后端（终端 1）
cd server
npm install
npm run dev          # tsx watch，默认 3001 端口，数据库在 server/data/powder.db

# 前端（终端 2）
cd web
npm install
npm run dev          # Vite，默认 5173 端口，/api 自动代理到 3001
```

## 测试

```bash
cd server && npm test   # 20 个用例：CSV 解析、API 集成、只增不改触发器
cd web && npm test      # 7 个用例：格式化函数、页面渲染、时间轴顺序
```

## 导入文件格式

CSV，首行表头可省略，空行自动跳过：

```csv
batch_no,event_type,weight_grams,device_no,event_time
P-2026-001,称重,4987.2,SCALE-01,2026-09-05 14:20:00
P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00
```

- 事件类型：`称重`/`weighing`、`筛分`/`sieving`（大小写不敏感）
- 事件时间：`YYYY-MM-DD HH:MM[:SS]` 或 `YYYY-MM-DDTHH:MM[:SS]`
- 重量：正数，单位克
- 导入前批次必须已登记

仓库根目录的 `sample-records.csv` 是一份示例（行序故意与时间顺序相反，可用于验证时间轴排序）。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/batches` | 批次登记（自动生成新粉到货事件） |
| GET | `/api/batches` | 批次列表 |
| POST | `/api/imports` | 导入称重/筛分记录（body：`{filename?, content}`） |
| GET | `/api/imports/:id/raw` | 原样取回导入文件内容 |
| GET | `/api/batches/:batchNo/events` | 批次事件时间轴（按事件时间升序） |
| GET | `/api/health` | 健康检查 |

## 目录结构

```
├── docker-compose.yml      # 一键起环境
├── sample-records.csv      # 示例导入文件
├── server/                 # Fastify + better-sqlite3
│   ├── src/{index,app,db,csv}.ts
│   └── test/               # Vitest（内存库 + app.inject 真实请求）
└── web/                    # React + Vite
    ├── src/pages/          # 批次登记 / 记录导入 / 批次时间轴
    └── nginx.conf          # 生产环境 /api 反代
```
