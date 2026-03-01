/**
 * Phase D1.1–D1.3 会员中心：积分、储值、优惠券、订单历史、核销入口
 * 2026-02-28T18:22:00+08:00
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getMemberProfile,
  listMemberOrders,
  listMemberCoupons,
} from "../../https";

const cardClass = "bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]";
const btnClass =
  "px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700";

const MemberCenter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const raw = localStorage.getItem("memberSession");
    if (!raw) {
      navigate("/member/login");
      return;
    }
    try {
      const s = JSON.parse(raw);
      setSession(s);
    } catch {
      navigate("/member/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (!session?.memberCode || !session?.phone) return;

    const load = async () => {
      setLoading(true);
      try {
        const params = { phone: session.phone, locationId: "default" };
        const [pRes, oRes, cRes] = await Promise.all([
          getMemberProfile(session.memberCode, params),
          listMemberOrders(session.memberCode, { ...params, limit: 10 }),
          listMemberCoupons(session.memberCode, params),
        ]);
        setProfile(pRes?.data?.data ?? null);
        setOrders(oRes?.data?.data ?? []);
        setCoupons(cRes?.data?.data ?? []);
      } catch (err) {
        if (err?.response?.status === 404) {
          localStorage.removeItem("memberSession");
          navigate("/member/login");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session?.memberCode, session?.phone, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("memberSession");
    navigate("/member/login");
  };

  if (!session) return null;
  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <p className="text-[#666]">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20">
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-white">{t("member.center")}</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-[#888] hover:text-white"
          >
            {t("member.logout")}
          </button>
        </div>

        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className={cardClass}>
                <p className="text-[#888] text-xs mb-1">{t("member.points")}</p>
                <p className="text-xl font-bold text-amber-400">
                  {profile?.pointsBalance ?? 0}
                </p>
              </div>
              <div className={cardClass}>
                <p className="text-[#888] text-xs mb-1">{t("member.wallet")}</p>
                <p className="text-xl font-bold text-green-400">
                  ¥{Number(profile?.walletBalance ?? 0).toFixed(2)}
                </p>
              </div>
              <div className={cardClass}>
                <p className="text-[#888] text-xs mb-1">{t("member.coupons")}</p>
                <p className="text-xl font-bold text-indigo-400">
                  {coupons.filter((c) => c.usable).length}
                </p>
              </div>
            </div>

            <div className={cardClass + " mb-4"}>
              <h2 className="font-medium text-white mb-3">{t("member.myCoupons")}</h2>
              {coupons.length === 0 ? (
                <p className="text-[#666] text-sm">{t("member.noCoupons")}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {coupons.slice(0, 5).map((c) => (
                    <div
                      key={c._id}
                      className={`p-3 rounded-lg border ${
                        c.usable
                          ? "bg-[#1f2a2a] border-indigo-500/50"
                          : "bg-[#151515] border-[#333] opacity-70"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-indigo-300">{c.code}</span>
                        <span className="text-xs text-[#888]">
                          {c.usageCount}/{c.usageLimit}
                        </span>
                      </div>
                      <p className="text-sm text-[#ccc] mt-1">{c.name}</p>
                      {c.usable && (
                        <p className="text-xs text-amber-400 mt-1">
                          {t("member.showToCashier")}
                        </p>
                      )}
                    </div>
                  ))}
                  {coupons.length > 5 && (
                    <p className="text-xs text-[#666]">
                      {t("member.andMore", { count: coupons.length - 5 })}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("orders")}
                className={btnClass + " flex-1"}
              >
                {t("member.orderHistory")}
              </button>
              <button
                onClick={() => setActiveTab("redeem")}
                className={btnClass + " flex-1"}
              >
                {t("member.redeemEntry")}
              </button>
            </div>
          </>
        )}

        {activeTab === "orders" && (
          <div className={cardClass}>
            <button
              onClick={() => setActiveTab("overview")}
              className="text-indigo-400 text-sm mb-4"
            >
              ← {t("common.back")}
            </button>
            <h2 className="font-medium text-white mb-3">{t("member.orderHistory")}</h2>
            {orders.length === 0 ? (
              <p className="text-[#666] text-sm">{t("member.noOrders")}</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div
                    key={o._id}
                    className="p-3 bg-[#151515] rounded-lg border border-[#2a2a2a]"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-[#ccc]">
                        {new Date(o.orderDate).toLocaleDateString()}
                      </span>
                      <span className="text-amber-400">
                        ¥{Number(o.totalWithTax ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-[#888] mt-1">
                      {t("member.status")}: {o.orderStatus} · {o.itemCount} {t("member.items")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "redeem" && (
          <div className={cardClass}>
            <button
              onClick={() => setActiveTab("overview")}
              className="text-indigo-400 text-sm mb-4"
            >
              ← {t("common.back")}
            </button>
            <h2 className="font-medium text-white mb-3">{t("member.redeemEntry")}</h2>
            <p className="text-[#999] text-sm mb-4">{t("member.redeemDesc")}</p>
            <div className="space-y-2">
              {coupons.filter((c) => c.usable).map((c) => (
                <div
                  key={c._id}
                  className="p-4 bg-[#1f2a2a] rounded-lg border border-indigo-500/50"
                >
                  <p className="font-mono text-lg text-indigo-300 font-bold">{c.code}</p>
                  <p className="text-sm text-[#ccc] mt-1">{c.name}</p>
                  <p className="text-xs text-amber-400 mt-2">
                    {t("member.showToCashier")}
                  </p>
                  {c.minOrderAmount > 0 && (
                    <p className="text-xs text-[#888] mt-1">
                      {t("member.minOrder", { amt: c.minOrderAmount })}
                    </p>
                  )}
                </div>
              ))}
              {coupons.filter((c) => c.usable).length === 0 && (
                <p className="text-[#666] text-sm">{t("member.noUsableCoupons")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberCenter;
