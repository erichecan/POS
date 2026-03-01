/**
 * Phase D1.4 会员登录/绑定 - 手机号验证或会员码绑定
 * 2026-02-28T18:20:00+08:00
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { bindMember } from "../../https";

const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500";
const btnClass =
  "w-full py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";

const MemberLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ memberCode: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.memberCode?.trim() || !form.phone?.trim()) {
      setError(t("member.enterMemberCodeAndPhone"));
      return;
    }
    setLoading(true);
    try {
      const { data } = await bindMember({
        memberCode: form.memberCode.trim().toUpperCase(),
        phone: form.phone.trim().replace(/\s/g, ""),
        locationId: "default",
      });
      const member = data?.data;
      if (member) {
        localStorage.setItem("memberSession", JSON.stringify({
          memberId: member._id,
          memberCode: member.memberCode,
          phone: form.phone.trim().replace(/\s/g, ""),
          name: member.name,
        }));
        navigate("/member");
      }
    } catch (err) {
      setError(err.response?.data?.message || t("member.bindFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          {t("member.loginTitle")}
        </h1>
        <p className="text-[#999] text-sm text-center mb-6">
          {t("member.loginDesc")}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#aaa] mb-1">{t("member.memberCode")}</label>
            <input
              className={inputClass}
              value={form.memberCode}
              onChange={(e) => setForm({ ...form, memberCode: e.target.value })}
              placeholder="M001"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm text-[#aaa] mb-1">{t("member.phone")}</label>
            <input
              className={inputClass}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="13800001001"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button type="submit" className={btnClass} disabled={loading}>
            {loading ? t("common.loading") : t("member.bind")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MemberLogin;
