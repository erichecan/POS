import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { BsCashCoin } from "react-icons/bs";
import { GrInProgress } from "react-icons/gr";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";

const Home = () => {

    useEffect(() => {
      document.title = "POS | Home"
    }, [])

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] overflow-hidden flex flex-col xl:flex-row gap-3">
      {/* Left Div */}
      <div className="flex-1 xl:flex-[3] min-h-0 overflow-y-auto pb-28 xl:pb-20">
        <Greetings />
        <div className="flex flex-col md:flex-row items-stretch w-full gap-3 px-4 md:px-8 mt-6">
          <MiniCard title="Total Earnings" icon={<BsCashCoin />} number={512} footerNum={1.6} />
          <MiniCard title="In Progress" icon={<GrInProgress />} number={16} footerNum={3.6} />
        </div>
        <RecentOrders />
      </div>
      {/* Right Div */}
      <div className="flex-1 xl:flex-[2] min-h-0 overflow-y-auto pb-28 xl:pb-20">
        <PopularDishes />
      </div>
      <BottomNav />
    </section>
  );
};

export default Home;
