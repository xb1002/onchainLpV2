import winston from "winston";

// Configure the logger
// 输出格式为timestamp + level + name + message
function createLogger(
  name: string,
  level: string = "info",
  logFlag: boolean = false,
  logFile: string = `logs/${name}.log`
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
  return winston.createLogger({
    level: level,
    transports: transports,
  });
}

export { createLogger };

if (require.main === module) {
  // If this file is run directly, create a logger instance and log a message
  const logger = createLogger("UniswapV3Lp");
  logger.info("Logger initialized for UniswapV3Lp");
  logger.error("This is an error message");
  logger.warn("This is a warning message");
  logger.debug("This is a debug message");
}
