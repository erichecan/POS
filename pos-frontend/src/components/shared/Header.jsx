import React from "react";
import { FaSearch } from "react-icons/fa";
import { FaUserCircle } from "react-icons/fa";
import { FaBell } from "react-icons/fa";
import logo from "../../assets/images/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAdmin = `${userData.role || ""}`.trim().toLowerCase() === "admin";

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: (data) => {
      console.log(data);
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#1a1a1a]">
      {/* LOGO */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 cursor-pointer min-h-[44px]"
      >
        <img src={logo} className="h-8 w-8" alt="restro logo" />
        <h1 className="text-lg font-semibold text-[#f5f5f5] tracking-wide">
          Restro
        </h1>
      </button>

      {/* SEARCH */}
      <div className="order-3 md:order-2 w-full md:flex-1 md:max-w-[420px] flex items-center gap-3 bg-[#1f1f1f] rounded-[15px] px-4 py-2 min-h-[44px]">
        <FaSearch className="text-[#f5f5f5]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-[#1f1f1f] outline-none text-[#f5f5f5] w-full"
        />
      </div>

      {/* LOGGED USER DETAILS */}
      <div className="order-2 md:order-3 flex items-center gap-2 md:gap-3">
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            aria-label="Open admin dashboard"
            title="Open admin dashboard"
            className="bg-[#1f1f1f] rounded-[15px] min-h-[44px] min-w-[44px] px-3 flex items-center justify-center"
          >
            <MdDashboard className="text-[#f5f5f5] text-xl md:text-2xl" />
          </button>
        )}
        <button
          type="button"
          className="bg-[#1f1f1f] rounded-[15px] min-h-[44px] min-w-[44px] px-3 flex items-center justify-center"
        >
          <FaBell className="text-[#f5f5f5] text-xl md:text-2xl" />
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          <FaUserCircle className="text-[#f5f5f5] text-3xl md:text-4xl" />
          <div className="hidden md:flex flex-col items-start">
            <h1 className="text-sm md:text-md text-[#f5f5f5] font-semibold tracking-wide">
              {userData.name || "TEST USER"}
            </h1>
            <p className="text-xs text-[#ababab] font-medium">
              {userData.role || "Role"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-[#f5f5f5] ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <IoLogOut size={28} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
