import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";

type Status = "granted" | "denied" | "unsupported" | "unknown";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function PermissionBanner() {
  const [status, setStatus] = useState<Status>("unknown");

  const check = useCallback(async () => {
    if (!inTauri()) return setStatus("unsupported");
    try {
      setStatus((await invoke<string>("accessibility_status")) as Status);
    } catch (err) {
      console.warn("[animalize] accessibility_status failed:", err);
      setStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    void check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);

  if (status !== "denied") return null;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
      <p className="font-bold">다른 앱에서 타자 칠 때도 소리가 나려면 '손쉬운 사용' 권한이 필요해요</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>아래 '설정 열기' 버튼을 눌러요.</li>
        <li>목록에서 Animalize를 찾아 스위치를 켜요.</li>
        <li>이 창으로 돌아와 '다시 확인'을 눌러요.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void invoke("open_accessibility_settings")}>설정 열기</Button>
        <Button variant="outline" onClick={() => void check()}>
          다시 확인
        </Button>
      </div>
    </div>
  );
}
