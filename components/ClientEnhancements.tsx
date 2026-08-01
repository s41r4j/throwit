"use client";

import { useEffect } from "react";

const MAX_PULL = 108;

const ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 20 6v5c0 5.2-3.3 8.3-8 10-4.7-1.7-8-4.8-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M12 15h5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10V8a4 4 0 1 1 8 0v2"/><rect x="5" y="10" width="14" height="11" rx="3"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8h8l2 4-2 7H8l-2-7 2-4Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M4 12h3M17 12h3M5 17l3-1M19 17l-3-1"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 12a3.5 3.5 0 1 1 7 0c0 4-1.7 6.6-4.2 8"/><path d="M6 12a6 6 0 0 1 12 0c0 2-.4 4-1.3 5.8M4 12a8 8 0 0 1 16 0M10 12c0 2-.4 3.5-1.5 5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15 4 20l5-2M17 15l3 5-5-2"/><circle cx="12" cy="9" r="5"/><path d="M12 4V1M7.5 6 5 4M16.5 6 19 4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 11 7.2-3.8M8.3 13l7.2 3.8"/></svg>',
];

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function fileType(name: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
  if (["PNG", "JPG", "JPEG", "GIF", "WEBP", "SVG"].includes(extension || "")) return `${extension} image`;
  if (["MP4", "MOV", "MKV", "WEBM"].includes(extension || "")) return `${extension} video`;
  if (["MP3", "WAV", "M4A", "FLAC"].includes(extension || "")) return `${extension} audio`;
  if (extension === "PDF") return "PDF document";
  if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(extension || "")) return `${extension} archive`;
  if (["TXT", "MD", "DOC", "DOCX", "CSV", "JSON"].includes(extension || "")) return `${extension} document`;
  return extension ? `${extension} file` : "Secure file";
}

export default function ClientEnhancements() {
  useEffect(() => {
    let activeCore: HTMLElement | null = null;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let pullX = 0;
    let pullY = 0;
    let suppressActionAnimation = false;
    let tether: HTMLElement | null = null;

    const enhanceIcons = () => {
      document.querySelectorAll<HTMLElement>(".peer").forEach((peer) => {
        const icon = peer.querySelector<HTMLElement>(".device-icon");
        const name = peer.querySelector<HTMLElement>(".peer-copy strong")?.textContent?.trim() || "device";
        if (!icon || icon.dataset.cyberIcon === name) return;
        icon.innerHTML = ICONS[hash(name) % ICONS.length];
        icon.dataset.cyberIcon = name;
      });
    };

    const enhanceFooter = () => {
      const footer = document.querySelector<HTMLElement>("footer");
      if (!footer || footer.querySelector(".footer-credit")) return;
      footer.classList.add("credit-footer");
      const credit = document.createElement("div");
      credit.className = "footer-credit";
      const made = document.createElement("span");
      made.textContent = "made w/ <3";
      const link = document.createElement("a");
      link.href = "https://x.com/s41r4j";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "@s41r4j";
      credit.append(made, link);
      footer.append(credit);
    };

    const enhanceModals = () => {
      document.querySelectorAll<HTMLElement>(".modal section").forEach((section) => {
        if (section.dataset.professional === "true") return;
        const heading = section.querySelector<HTMLHeadingElement>("h2");
        const size = section.querySelector<HTMLParagraphElement>("p");
        if (!heading || !size) return;

        const rawName = heading.textContent?.trim() || "Incoming file";
        const name = rawName.startsWith("Catch ") ? rawName.slice(6).replace(/\?$/, "") : rawName;
        const sender = document.querySelector<HTMLElement>(".peer.active .peer-copy strong")?.textContent?.trim();
        heading.textContent = name;

        const meta = document.createElement("div");
        meta.className = "professional-file-meta";
        const type = document.createElement("span");
        type.textContent = fileType(name);
        const amount = document.createElement("strong");
        amount.textContent = size.textContent?.replace(" is ready to save.", "") || "Unknown size";
        const source = document.createElement("small");
        source.textContent = section.closest(".caught-modal")
          ? "Verified complete in browser memory"
          : `From ${sender || "a nearby device"} · encrypted WebRTC`;
        meta.append(type, amount, source);
        heading.insertAdjacentElement("afterend", meta);
        size.classList.add("professional-file-note");
        if (!section.closest(".caught-modal")) {
          size.textContent = "Review the file details before accepting the transfer.";
        }
        section.dataset.professional = "true";
      });
    };

    const refresh = () => {
      enhanceIcons();
      enhanceFooter();
      enhanceModals();
    };

    const resetCore = (core: HTMLElement) => {
      core.style.transform = "";
      core.classList.remove("slingshot-dragging", "slingshot-flying");
      tether?.remove();
      tether = null;
      activeCore = null;
      pointerId = -1;
      pullX = 0;
      pullY = 0;
    };

    const payloadAction = () => {
      const activeTab = document.querySelector<HTMLElement>(".tabs button.active")?.textContent?.trim().toLowerCase();
      if (activeTab === "text") {
        const form = document.querySelector<HTMLFormElement>(".text-dock form");
        const button = form?.querySelector<HTMLButtonElement>("button");
        if (!form || !button || button.disabled) return false;
        suppressActionAnimation = true;
        form.requestSubmit();
        window.setTimeout(() => { suppressActionAnimation = false; }, 0);
        return true;
      }
      const button = document.querySelector<HTMLButtonElement>(".throw");
      if (!button || button.disabled) return false;
      suppressActionAnimation = true;
      button.click();
      window.setTimeout(() => { suppressActionAnimation = false; }, 0);
      return true;
    };

    const animateToTarget = (core: HTMLElement, x: number, y: number, triggerPayload: boolean) => {
      const target = document.querySelector<HTMLElement>(".peer.active .device-icon");
      if (!target) {
        resetCore(core);
        return;
      }
      const coreRect = core.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const baseX = coreRect.left + coreRect.width / 2 - x;
      const baseY = coreRect.top + coreRect.height / 2 - y;
      const targetX = targetRect.left + targetRect.width / 2 - baseX;
      const targetY = targetRect.top + targetRect.height / 2 - baseY;
      const distance = Math.max(1, Math.hypot(targetX, targetY));
      const arc = Math.min(170, 92 + Math.hypot(x, y) * 0.7);
      const side = Math.sign(x * targetY - y * targetX) || 1;
      const curveX = targetX * 0.48 + (-targetY / distance) * arc * side;
      const curveY = targetY * 0.48 + (targetX / distance) * arc * side - 82;

      core.classList.remove("slingshot-dragging");
      core.classList.add("slingshot-flying");
      tether?.remove();
      tether = null;
      core.style.transform = "";

      const animation = core.animate(
        [
          { opacity: 1, transform: `translate(${x}px, ${y}px) scale(1) rotate(-5deg)` },
          { opacity: 1, transform: `translate(${-x * 0.58}px, ${-y * 0.58}px) scale(.94) rotate(74deg)`, offset: 0.13 },
          { opacity: 1, transform: `translate(${curveX}px, ${curveY}px) scale(.76) rotate(405deg)`, offset: 0.55 },
          { opacity: 0.94, transform: `translate(${targetX}px, ${targetY}px) scale(.35) rotate(704deg)`, offset: 0.88 },
          { opacity: 0, transform: `translate(${targetX}px, ${targetY}px) scale(.08) rotate(790deg)` },
        ],
        { duration: 1340, easing: "cubic-bezier(.14,.7,.12,1)", fill: "forwards" },
      );

      document.querySelector(".radar")?.classList.add("enhanced-throwing");
      if (triggerPayload) window.setTimeout(payloadAction, 170);
      animation.finished.finally(() => {
        animation.cancel();
        document.querySelector(".radar")?.classList.remove("enhanced-throwing");
        resetCore(core);
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const core = (event.target as Element | null)?.closest<HTMLElement>(".paper-core");
      if (!core || core.classList.contains("slingshot-flying")) return;
      if (!document.querySelector(".peer.active")) return;
      activeCore = core;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      pullX = 0;
      pullY = 0;
      core.setPointerCapture(event.pointerId);
      core.classList.add("slingshot-dragging");
      tether = document.createElement("span");
      tether.className = "enhanced-sling-tether";
      core.parentElement?.append(tether);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!activeCore || pointerId !== event.pointerId) return;
      pullX = event.clientX - startX;
      pullY = event.clientY - startY;
      const distance = Math.hypot(pullX, pullY);
      if (distance > MAX_PULL) {
        const scale = MAX_PULL / distance;
        pullX *= scale;
        pullY *= scale;
      }
      activeCore.style.transform = `translate(${pullX}px, ${pullY}px)`;
      if (tether) {
        tether.style.width = `${Math.hypot(pullX, pullY)}px`;
        tether.style.transform = `rotate(${Math.atan2(pullY, pullX)}rad)`;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!activeCore || pointerId !== event.pointerId) return;
      const core = activeCore;
      if (core.hasPointerCapture(event.pointerId)) core.releasePointerCapture(event.pointerId);
      if (Math.hypot(pullX, pullY) < 12) resetCore(core);
      else animateToTarget(core, pullX, pullY, true);
    };

    const onClick = (event: MouseEvent) => {
      if (suppressActionAnimation) return;
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(".throw");
      if (!button || button.disabled) return;
      const core = document.querySelector<HTMLElement>(".paper-core");
      if (core) animateToTarget(core, -28, 34, false);
    };

    const onSubmit = (event: SubmitEvent) => {
      if (suppressActionAnimation) return;
      const form = event.target as HTMLFormElement | null;
      if (!form?.closest(".text-dock")) return;
      const core = document.querySelector<HTMLElement>(".paper-core");
      if (core) animateToTarget(core, 30, 38, false);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      tether?.remove();
      document.querySelector(".footer-credit")?.remove();
    };
  }, []);

  return null;
}
