# 🤝 Contributing to Restaurant POS System

Thank you for considering contributing to the **Restaurant POS System**! Your help is essential for making this project even better. 💖

## 🧾 Table of Contents
- [How to Contribute](#-how-to-contribute)
- [Contribution Guidelines](#-contribution-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Reporting Issues](#-reporting-issues)
- [License](#-license)
- [Copyright Notice](#-copyright-notice)

---

## 🏢 How to Contribute

1. **Fork the repository** 📚
2. **Clone your fork**（使用当前仓库与主开发分支。2026-02-24 CODE_REVIEW C2 修正）
   ```bash
   git clone https://github.com/erichecan/POS.git
   cd POS
   ```
   若需指定分支（请与仓库实际主分支一致，如 `main` 或 `dev`）：
   ```bash
   git clone --branch main https://github.com/erichecan/POS.git
   cd POS
   ```
3. **Navigate into the project directory**（若上一步未 cd）
   ```bash
   cd POS
   ```
4. **Create a new branch** 🌿
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Navigate to the backend and frontend directories**
   ```bash
   cd pos-backend
   npm install

   cd ../pos-frontend
   npm install
   ```

6. **Set up environment variables**
   - Create a `.env` file in both `pos-backend` and `pos-frontend` using `.env.example` as a reference.

7. **Run the backend server** (Port: `8000`)
   ```bash
   cd pos-backend
   npm run dev
   ```

8. **Run the frontend server** (Port: `5173`)
   ```bash
   cd pos-frontend
   npm run dev
   ```
9. **Make your changes** ✨
10. **Commit your changes** 💾
   ```bash
   git commit -m "Add: A meaningful commit message"
   ```
11. **Push to your branch** 👤
   ```bash
   git push origin feature/your-feature-name
   ```
12. **Create a Pull Request** 🛠️

---

## 📋 Contribution Guidelines

- **需求基准**：修改前请查阅产品需求文档（`docs/PRD_Global_POS_2026.md`），以 PRD 为需求基准，不自行创造需求。（2026-02-24 CODE_REVIEW 文档补充）
- Follow the existing code style and naming conventions.
- Write clear, concise commit messages.
- Add comments where necessary.
- **注释与时间戳**：对业务逻辑或核心领域的重要变更，建议在关键处添加简要修改说明与时间戳（到秒）；若团队约定为可选，以 CONTRIBUTING 或项目规则为准。（2026-02-24 CODE_REVIEW S1）

---

## ✅ Pull Request Process

- Always branch out from the repository’s main development branch（如 `main` 或 `dev`，以仓库为准）.
- Submit your pull request to that same branch.
- Ensure your PR is linked to an issue if applicable.
- Wait for approval before merging.
- Only maintainers can merge into the `master` branch.

---

## 🐛 Reporting Issues

Found a bug or have a feature request? Open an [Issue](https://github.com/erichecan/POS/issues) and follow the template provided.

---

## 🐝 Copyright Notice

The UI of this project is **copyrighted content**. You **cannot** copy and sell it as your own product. Unauthorized use, redistribution, or resale of the UI is strictly prohibited.

Original UI design can be found on [Behance](https://www.behance.net/gallery/210280099/Restaurant-POS-System-Point-of-Sale-UIUX-Design).

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

Happy Coding! 💻🎉

