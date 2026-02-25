import React from "react";
import { Link } from "react-router-dom";

/**
 * 404 页面组件
 * 2026-02-24 CODE_REVIEW S4：统一 404 文案与样式，提供返回首页入口
 */
const NotFound = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 bg-[#1f1f1f] text-[#e0e0e0]">
      <h1 className="text-4xl font-semibold text-[#ababab]">404</h1>
      <p className="text-lg text-center">页面不存在</p>
      <Link
        to="/"
        className="mt-2 px-6 py-2 rounded-lg bg-[#4a4a4a] hover:bg-[#5a5a5a] text-white transition"
      >
        返回首页
      </Link>
    </div>
  );
};

export default NotFound;
