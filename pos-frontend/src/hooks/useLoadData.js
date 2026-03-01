import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useNavigate, useLocation } from "react-router-dom";

// 2026-02-26: 在 /auth 不请求 /api/user，避免 401 → 重定向 → 再请求 → 死循环闪屏
// 2026-02-28T18:46:00+08:00 Phase B - /kiosk、/order/* 为公开页，不校验登录
const PUBLIC_PATHS = ["/auth", "/kiosk"];
const isPublicPath = (pathname) =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/order/");

const useLoadData = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pathname = location.pathname || "";
    if (isPublicPath(pathname)) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role } = data.data;
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch (error) {
        dispatch(removeUser());
        navigate("/auth", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [dispatch, navigate, location.pathname]);

  return isLoading;
};

export default useLoadData;
