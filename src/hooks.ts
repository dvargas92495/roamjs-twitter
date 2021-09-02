import { useMemo } from "react";
import { getTreeByPageName } from "roam-client";

export const useSocialToken = (): string =>
  useMemo(
    () =>
      getTreeByPageName("roam/js/social").find((t) => /token/i.test(t.text))
        ?.children?.[0]?.text,
    []
  );
