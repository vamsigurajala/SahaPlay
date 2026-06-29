import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Flag, X, ChevronDown, Upload, AlertCircle } from "lucide-react";

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment / Abuse" },
  { value: "spam", label: "Spam / Advertising" },
  { value: "hate_speech", label: "Hate Speech / Discrimination" },
  { value: "inappropriate_content", label: "Inappropriate / Explicit Content" },
  { value: "threats", label: "Threats / Violence" },
  { value: "other", label: "Other" },
];

export default function ReportMessageModal({ msg, roomId, reporterUsername, onClose, apiBase, isDark }) {
  const isLight = !isDark;
  const [reason, setReason] = useState("harassment");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [imgErr, setImgErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);
  const reasonRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!reasonOpen) return;
    function handleOutside(e) {
      if (reasonRef.current && !reasonRef.current.contains(e.target)) setReasonOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [reasonOpen]);

  useEffect(() => {
    return () => images.forEach(img => URL.revokeObjectURL(img.preview));
  }, []);

  const processFiles = useCallback((files) => {
    setImgErr("");
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) { setImgErr("Maximum " + MAX_IMAGES + " images allowed."); return; }
    const toAdd = [];
    let errMsg = "";
    for (const f of Array.from(files).slice(0, slots)) {
      if (!ALLOWED_TYPES.includes(f.type)) { errMsg = "Only JPG, PNG, GIF, WEBP images allowed."; continue; }
      if (f.size > MAX_BYTES) { errMsg = '"' + f.name + '" exceeds 5 MB limit.'; continue; }
      toAdd.push({ file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type });
    }
    if (errMsg) setImgErr(errMsg);
    if (toAdd.length) setImages(prev => [...prev, ...toAdd]);
  }, [images.length]);

  const removeImg = (i) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, j) => j !== i);
    });
    setImgErr("");
  };

  const onDragEnter = (e) => { e.preventDefault(); dragCount.current++; setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragCount.current--; if (dragCount.current === 0) setDragging(false); };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => { e.preventDefault(); dragCount.current = 0; setDragging(false); processFiles(e.dataTransfer.files); };

  const toB64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  const handleSubmit = async () => {
    if (images.length === 0) { setImgErr("At least 1 proof image is required to submit a report."); return; }
    setSubmitting(true);
    setError("");
    try {
      const imagePayload = await Promise.all(images.map(async img => ({
        data: await toB64(img.file),
        type: img.type,
        name: img.name,
      })));
      const token = localStorage.getItem("watch_token");
      const res = await fetch(apiBase + "/api/report-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({
          roomId: roomId || null,
          reporterUsername,
          reportedUsername: msg.username || msg.senderName || "Unknown",
          message: msg.decryptedText || msg.message || "",
          reason,
          description: description.trim(),
          images: imagePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to submit report. Please try again.");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBorder = isLight ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.12)";
  const inputBg = isLight ? "#f8fafc" : "rgba(255,255,255,0.05)";
  const textPrimary = isLight ? "#1e293b" : "#ffffff";
  const textSecondary = isLight ? "#64748b" : "#9ca3af";
  const labelColor = isLight ? "#475569" : "#9ca3af";

  const modal = (
    React.createElement("div", {
      onClick: onClose,
      className: "report-modal-overlay",
      style: {
        position: "fixed", inset: 0, background: isLight ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.7)",
        zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, backdropFilter: "blur(4px)",
      }
    },
      React.createElement("div", {
        onClick: e => e.stopPropagation(),
        className: "report-modal-card no-scrollbar",
        style: {
          position: "relative", background: isLight ? "#ffffff" : "#141420",
          border: inputBorder, borderRadius: 24, padding: 32, width: "90vw", maxWidth: 500,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: isLight ? "0 32px 80px rgba(0,0,0,0.15)" : "0 40px 100px rgba(0,0,0,0.9)",
        }
      },
        /* Close button */
        React.createElement("button", {
          onClick: onClose,
          style: {
            position: "absolute", top: 16, right: 16, width: 36, height: 36,
            borderRadius: "50%", background: isLight ? "#f1f5f9" : "rgba(255,255,255,0.08)",
            border: "none", color: textPrimary, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }
        }, React.createElement(X, { size: 16 })),

        submitted ? (
          /* Success state */
          React.createElement("div", { style: { textAlign: "center", padding: "8px 0 8px" } },
            React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "✅"),
            React.createElement("h3", { style: { margin: "0 0 8px", color: textPrimary, fontSize: 20, fontWeight: 800 } }, "Report Submitted"),
            React.createElement("p", { style: { color: textSecondary, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" } },
              "Thank you. Our team will review this report and take appropriate action."
            ),
            React.createElement("button", {
              onClick: onClose,
              style: {
                padding: "10px 28px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }
            }, "Done")
          )
        ) : (
          React.createElement(React.Fragment, null,
            React.createElement("style", null, `
              .no-scrollbar::-webkit-scrollbar { display: none !important; }
              .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
              .report-modal-card {
                padding: 32px !important;
                max-height: 90vh !important;
              }
              @media (max-width: 600px) {
                .report-modal-card {
                  padding: 16px 20px 20px !important;
                  border-radius: 16px !important;
                  max-height: 92vh !important;
                  width: 95vw !important;
                }
              }
            `),
            /* Header */
            React.createElement("h3", { style: { margin: "0 0 6px", color: textPrimary, fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 } },
              React.createElement(Flag, { size: 20, color: "#ef4444" }), "Report Message"
            ),
            React.createElement("p", { style: { color: textSecondary, fontSize: 13, margin: "0 0 8px", lineHeight: 1.5 } },
              "Reporting message from ",
              React.createElement("strong", { style: { color: textPrimary } }, "@" + (msg.username || msg.senderName || "Unknown"))
            ),
            /* Message preview */
            React.createElement("div", {
              style: {
                background: inputBg, border: inputBorder, borderRadius: 10,
                padding: "10px 14px", marginBottom: 22,
                fontSize: 13, color: textSecondary, lineHeight: 1.5, maxHeight: 72, overflow: "hidden",
              }
            }, React.createElement("em", null,
              "\u201c" + (msg.decryptedText || msg.message || "").slice(0, 180) +
              ((msg.decryptedText || msg.message || "").length > 180 ? "\u2026" : "") + "\u201d"
            )),

            /* Reason */
            React.createElement("div", { style: { marginBottom: 18 } },
              React.createElement("label", { style: { display: "block", fontSize: 11, fontWeight: 700, color: labelColor, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" } }, "Reason for Report"),
              React.createElement("div", { ref: reasonRef, style: { position: "relative", userSelect: "none" } },
                React.createElement("div", {
                  onClick: () => setReasonOpen(o => !o),
                  style: {
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: reasonOpen ? "10px 10px 0 0" : 10,
                    border: inputBorder, background: inputBg, color: textPrimary,
                    fontSize: 14, cursor: "pointer", boxSizing: "border-box",
                  }
                },
                  React.createElement("span", null, REPORT_REASONS.find(r => r.value === reason)?.label || reason),
                  React.createElement(ChevronDown, { size: 15, style: { flexShrink: 0, marginLeft: 8, transition: "transform 0.2s", transform: reasonOpen ? "rotate(180deg)" : "none" } })
                ),
                reasonOpen && React.createElement("div", {
                  style: {
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: isLight ? "#fff" : "#1e1e2e", border: inputBorder, borderTop: "none",
                    borderRadius: "0 0 10px 10px", overflow: "hidden",
                    boxShadow: isLight ? "0 8px 24px rgba(0,0,0,0.1)" : "0 8px 24px rgba(0,0,0,0.6)",
                  }
                }, REPORT_REASONS.map(opt =>
                  React.createElement("div", {
                    key: opt.value,
                    onClick: () => { setReason(opt.value); setReasonOpen(false); },
                    style: {
                      padding: "10px 14px", cursor: "pointer", fontSize: 14,
                      color: isLight ? "#1e293b" : "#e2e8f0",
                      background: reason === opt.value ? (isLight ? "#f0f4ff" : "rgba(99,102,241,0.18)") : "transparent",
                      fontWeight: reason === opt.value ? 700 : 400,
                    },
                    onMouseEnter: e => { e.currentTarget.style.background = isLight ? "#f1f5f9" : "rgba(255,255,255,0.08)"; },
                    onMouseLeave: e => { e.currentTarget.style.background = reason === opt.value ? (isLight ? "#f0f4ff" : "rgba(99,102,241,0.18)") : "transparent"; },
                  }, opt.label)
                ))
              )
            ),

            /* Description */
            React.createElement("div", { style: { marginBottom: 18 } },
              React.createElement("label", { style: { display: "block", fontSize: 11, fontWeight: 700, color: labelColor, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" } },
                "Details ", React.createElement("span", { style: { fontWeight: 400, textTransform: "none", letterSpacing: 0 } }, "(optional)")
              ),
              React.createElement("textarea", {
                rows: 3, value: description,
                onChange: e => setDescription(e.target.value),
                placeholder: "Provide any additional context about this report...",
                style: {
                  width: "100%", boxSizing: "border-box", padding: "11px 14px",
                  borderRadius: 10, border: inputBorder, background: inputBg,
                  color: textPrimary, fontSize: 14, outline: "none",
                  fontFamily: "inherit", resize: "none", lineHeight: 1.5,
                }
              })
            ),

            /* Image upload */
            React.createElement("div", { style: { marginBottom: 22 } },
              React.createElement("label", { style: { display: "block", fontSize: 11, fontWeight: 700, color: labelColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.6px" } },
                "Proof Images ", React.createElement("span", { style: { color: "#ef4444", fontWeight: 800 } }, "*")
              ),
              React.createElement("p", { style: { fontSize: 12, color: textSecondary, margin: "0 0 10px" } },
                "At least 1 screenshot required. Max " + MAX_IMAGES + " images, 5 MB each."
              ),
              images.length < MAX_IMAGES && React.createElement("div", {
                onDragEnter, onDragLeave, onDragOver, onDrop,
                onClick: () => fileInputRef.current?.click(),
                style: {
                  border: "2px dashed " + (dragging ? "#6366f1" : (imgErr && images.length === 0 ? "#ef4444" : (isLight ? "#94a3b8" : "rgba(255,255,255,0.2)"))),
                  borderRadius: 12, padding: "20px 16px", textAlign: "center",
                  cursor: "pointer", background: dragging ? (isLight ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.1)") : "transparent",
                  transition: "all 0.15s",
                }
              },
                React.createElement(Upload, { size: 22, style: { color: "#6366f1", marginBottom: 8 } }),
                React.createElement("div", { style: { fontSize: 13, color: textPrimary, fontWeight: 600, marginBottom: 2 } },
                  React.createElement("span", { style: { color: "#818cf8" } }, "Click to attach"), " or drag and drop"
                ),
                React.createElement("div", { style: { fontSize: 12, color: textSecondary } }, "JPG, PNG, GIF, WEBP \u2014 up to 5 MB each"),
                React.createElement("input", {
                  ref: fileInputRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" },
                  onChange: e => { processFiles(e.target.files); e.target.value = ""; }
                })
              ),
              imgErr && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "#ef4444", fontSize: 12 } },
                React.createElement(AlertCircle, { size: 13 }), imgErr
              ),
              images.length > 0 && React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } },
                images.map((img, i) => React.createElement("div", {
                  key: i, style: { position: "relative", borderRadius: 8, overflow: "hidden", border: inputBorder, flexShrink: 0 }
                },
                  React.createElement("img", { src: img.preview, alt: img.name, style: { width: 72, height: 56, objectFit: "cover", display: "block" } }),
                  React.createElement("button", {
                    onClick: () => removeImg(i),
                    style: {
                      position: "absolute", top: 2, right: 2, width: 18, height: 18,
                      borderRadius: "50%", background: "rgba(0,0,0,0.75)", border: "none",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0,
                    }
                  }, React.createElement(X, { size: 10, color: "#ffffff", style: { color: "#ffffff" } }))
                ))
              ),
              images.length > 0 && React.createElement("p", { style: { fontSize: 12, color: textSecondary, margin: "8px 0 0" } },
                images.length + " / " + MAX_IMAGES + " images attached"
              )
            ),

            /* Error */
            error && React.createElement("div", {
              style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }
            }, error),

            /* Buttons */
            React.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "flex-end" } },
              React.createElement("button", {
                onClick: onClose,
                style: { padding: "10px 18px", borderRadius: 12, border: inputBorder, background: "transparent", color: textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" }
              }, "Cancel"),
              React.createElement("button", {
                disabled: submitting || images.length === 0,
                onClick: handleSubmit,
                title: images.length === 0 ? "At least 1 proof image is required" : undefined,
                style: {
                  padding: "10px 22px", borderRadius: 12, border: "none",
                  background: images.length === 0 ? (isLight ? "#d1d5db" : "rgba(255,255,255,0.1)") : "#ef4444",
                  color: images.length === 0 ? (isLight ? "#9ca3af" : "rgba(255,255,255,0.35)") : "#ffffff",
                  fontSize: 13, fontWeight: 700, cursor: (submitting || images.length === 0) ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                }
              }, React.createElement(Flag, { size: 14 }), submitting ? "Submitting\u2026" : "Submit Report")
            ),
            images.length === 0 && React.createElement("p", {
              style: { textAlign: "center", fontSize: 12, color: "#ef4444", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }
            }, React.createElement(AlertCircle, { size: 12 }), "Proof images are required to submit this report")
          )
        )
      )
    )
  );

  return createPortal(modal, document.body);
}
