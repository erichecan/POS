/** Kitchen Event Replay sub-page. 2026-02-26 */
import React from "react";
import KitchenBoard from "../../components/dashboard/KitchenBoard";

const KitchenReplayPage = () => (
  <div className="container mx-auto py-6 px-4 md:px-6">
    <KitchenBoard initialSection="replay" />
  </div>
);

export default KitchenReplayPage;
