/** Channel Markets sub-page. 2026-02-26 */
import React from "react";
import ChannelConfig from "../../components/dashboard/ChannelConfig";

const ChannelMarketsPage = () => (
  <div className="container mx-auto py-6 px-4 md:px-6">
    <ChannelConfig initialSection="markets" />
  </div>
);

export default ChannelMarketsPage;
