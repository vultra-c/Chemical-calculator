发布签名证书放置处（用于 `npm run release`）

结构：
  sign/release/certificate.pem
  sign/release/private.pem

获取方式：
1. 在 AIoT-IDE 中登录小米账号后导出发布证书；或
2. 按 Vela 官方文档用 OpenSSL 自签生成后放入本目录。

注意：上架应用商店必须使用正式发布证书；
手表与手机 App 联通类功能要求两端证书一致。
调试阶段直接使用 `npm run build`（内置 debug 证书）即可真机侧载测试。
