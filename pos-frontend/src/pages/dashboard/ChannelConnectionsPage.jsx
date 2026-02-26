/** Channel Connections sub-page. 2026-02-26 */
import React from "react";
import ChannelConfig from "../../components/dashboard/ChannelConfig";

const ChannelConnectionsPage = () => (
  <div className="container mx-auto py-6 px-4 md:px-6">
    <ChannelConfig initialSection="connections" />
  </div>
);

export default ChannelConnectionsPage;
