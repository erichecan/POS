// 2026-02-28T12:05:00+08:00: PRD 7.22 行业模版消费端 - Profile Context
import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreVerticalProfile } from "../https";

const DEFAULT_LOCATION_ID = "default";

const VerticalProfileContext = createContext({
  profile: null,
  resolved: null,
  isLoading: false,
  isError: false,
  locationId: DEFAULT_LOCATION_ID,
});

export const useVerticalProfile = () => useContext(VerticalProfileContext);

export const VerticalProfileProvider = ({ children, locationId = DEFAULT_LOCATION_ID }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vertical-profile", locationId],
    queryFn: () => getStoreVerticalProfile(locationId, { includeResolved: true }),
    staleTime: 5 * 60 * 1000,
  });

  const payload = data?.data?.data ?? null;
  const resolved = payload?.resolvedTemplate ?? null;

  return (
    <VerticalProfileContext.Provider
      value={{
        profile: payload,
        resolved,
        isLoading,
        isError,
        locationId,
      }}
    >
      {children}
    </VerticalProfileContext.Provider>
  );
};
