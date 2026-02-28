/** Channel Mapping Rules sub-page. 2026-02-26 */
// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import ChannelConfig from "../../components/dashboard/ChannelConfig";

const ChannelMappingsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <ChannelConfig initialSection="mappings" />
    </div>
  );
};

export default ChannelMappingsPage;
