# 本地背景图片

V0.1 没有正式背景，`background: ""` 使用 CSS 测试渐变。背景不包含标题、正文或落款文字。

后续将 5 张经人工筛选、确认使用权且不含患者隐私的图片放到这里，例如 `01.png` 至 `05.png`。建议使用 4:5、至少 2160 × 2700 像素的 PNG/JPEG/WebP；模板采用 `object-fit: cover` 居中裁切。

每期 JSON 可选择：

- `"background": "01"`：查找 `assets/backgrounds/01.png`，支持 `01` 至 `05`。
- `"background": "assets/backgrounds/01.png"`：相对于仓库根目录的路径。支持 PNG、JPG/JPEG、WebP。

不接受绝对路径、远程 URL、目录穿越或指向目录外的符号链接。找不到图片、解码失败时导出会报错。正式素材的来源、授权与用户确认记录应随素材补充。
