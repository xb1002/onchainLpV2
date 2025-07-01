import winston from "winston";
import Transport from "winston-transport";

// 回调函数类型定义
type LogCallback = (level: string, message: string, meta?: any) => void;

// 飞书推送函数示例
async function sendToFeishu(
  webhookUrl: string,
  message: string,
  level: string
) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: `[${level.toUpperCase()}] ${message}`,
        },
      }),
    });

    if (!response.ok) {
      console.error("飞书推送失败:", response.statusText);
    }
  } catch (error) {
    console.error("飞书推送错误:", error);
  }
}

// 自定义传输器，支持回调函数
class CallbackTransport extends Transport {
  private callbacks: Map<string, LogCallback>;

  constructor(opts: any) {
    super(opts);
    this.callbacks = opts.callbacks || new Map();
  }

  log(info: any, callback: () => void) {
    const { level, message, ...meta } = info;

    // 执行对应级别的回调函数
    const levelCallback = this.callbacks.get(level);
    if (levelCallback) {
      try {
        levelCallback(level, message, meta);
      } catch (error) {
        console.error(`回调函数执行失败 [${level}]:`, error);
      }
    }

    callback();
  }
}

// Configure the logger
// 输出格式为timestamp + level + name + message
function createLogger(
  name: string,
  level: string = "info",
  logFlag: boolean = false,
  logFile: string = `logs/${name}.log`,
  callbacks?: Map<string, LogCallback>
): winston.Logger {
  let transports: winston.transport[] = [];

  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}] ${name}: ${message}`;
        }),
        winston.format.colorize({ all: true }) // 对日志进行颜色化处理
      ),
    })
  );

  if (logFlag) {
    transports.push(
      new winston.transports.File({
        filename: logFile,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}] ${name}: ${message}`;
          })
        ),
      })
    );
  }

  // 添加回调传输器
  if (callbacks && callbacks.size > 0) {
    transports.push(new CallbackTransport({ callbacks }));
  }

  return winston.createLogger({
    level: level,
    transports: transports,
  });
}

// 便捷函数：创建带有飞书推送的logger
function createLoggerWithFeishu(
  name: string,
  level: string = "info",
  logFlag: boolean = false,
  logFile: string = `logs/${name}.log`,
  feishuWebhookUrl?: string
): winston.Logger {
  const callbacks = new Map<string, LogCallback>();

  if (!feishuWebhookUrl) {
    console.warn("飞书Webhook URL未提供，无法发送消息到飞书");
    return createLogger(name, level, logFlag, logFile, callbacks);
  }
  // 为warn和error级别添加飞书推送
  callbacks.set("warn", (level, message) => {
    sendToFeishu(feishuWebhookUrl, message, level);
  });

  callbacks.set("error", (level, message) => {
    sendToFeishu(feishuWebhookUrl, message, level);
  });

  callbacks.set("info", (level, message) => {
    sendToFeishu(feishuWebhookUrl, message, level);
  });

  return createLogger(name, level, logFlag, logFile, callbacks);
}

export { createLogger, createLoggerWithFeishu, LogCallback };

if (require.main === module) {
  // 测试普通logger
  const logger = createLogger("UniswapV3Lp");
  logger.info("Logger initialized for UniswapV3Lp");

  // 测试带飞书推送的logger
  const feishuLogger = createLoggerWithFeishu(
    "UniswapV3LpFeishu",
    "info",
    false,
    "logs/UniswapV3LpFeishu.log",
    "https://open.feishu.cn/open-apis/bot/v2/hook/011986cf-824b-44fc-8577-9238d3b63ce7"
  );
  feishuLogger.info("This is an info message");
  feishuLogger.warn("This is a warning message - will be sent to Feishu");
  feishuLogger.error("This is an error message - will be sent to Feishu");

  // 测试自定义回调
  const customCallbacks = new Map<string, LogCallback>();
  customCallbacks.set("info", (level, message) => {
    console.log(`自定义处理info消息: ${message}`);
  });

  const customLogger = createLogger(
    "CustomLogger",
    "info",
    false,
    "logs/custom.log",
    customCallbacks
  );
  customLogger.info("This info message will trigger custom callback");
}
