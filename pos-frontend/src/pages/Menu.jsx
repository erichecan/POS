import React, { useEffect, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdRestaurantMenu } from "react-icons/md";
import MenuContainer from "../components/menu/MenuContainer";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";
import { useSelector } from "react-redux";

const Menu = () => {
  const [isCartPanelOpen, setIsCartPanelOpen] = useState(false);

  useEffect(() => {
    document.title = "POS | Menu";
  }, []);

  const customerData = useSelector((state) => state.customer);
  const cartCount = useSelector((state) => state.cart.length);

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] overflow-hidden flex flex-col lg:flex-row gap-3">
      {/* Left Div */}
      <div className="flex-1 lg:flex-[3] min-h-0 overflow-y-auto pb-28 lg:pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 xl:px-10 py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">
              Menu
            </h1>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer">
              <MdRestaurantMenu className="text-[#f5f5f5] text-3xl md:text-4xl" />
              <div className="flex flex-col items-start">
                <h1 className="text-sm md:text-md text-[#f5f5f5] font-semibold tracking-wide">
                  {customerData.customerName || "Customer Name"}
                </h1>
                <p className="text-xs text-[#ababab] font-medium">Table : {customerData.table?.tableNo || "N/A"}</p>
              </div>
            </div>
            <button
              onClick={() => setIsCartPanelOpen(true)}
              className="lg:hidden min-h-[44px] rounded-lg px-3 py-2 bg-[#2f4f7a] text-[#dfefff] text-sm font-semibold"
            >
              Cart ({cartCount})
            </button>
          </div>
        </div>

        <MenuContainer />
      </div>
      {/* Right Div */}
      <div className="hidden lg:block lg:flex-[1] bg-[#1a1a1a] mt-4 mr-3 h-[calc(100vh-11rem)] overflow-y-auto rounded-lg pt-2 pb-20">
        {/* Customer Info */}
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Cart Items */}
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Bills */}
        <Bill />
      </div>

      {isCartPanelOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/55" onClick={() => setIsCartPanelOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[92vw] max-w-[520px] bg-[#1a1a1a] overflow-y-auto pt-3 pb-24"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pb-2">
              <h2 className="text-[#f5f5f5] text-lg font-semibold">Cart & Bill</h2>
              <button
                onClick={() => setIsCartPanelOpen(false)}
                className="min-h-[44px] min-w-[44px] text-[#ababab] text-xl"
              >
                ✕
              </button>
            </div>
            <CustomerInfo />
            <hr className="border-[#2a2a2a] border-t-2" />
            <CartInfo />
            <hr className="border-[#2a2a2a] border-t-2" />
            <Bill />
          </div>
        </div>
      )}

      <BottomNav />
    </section>
  );
};

export default Menu;
