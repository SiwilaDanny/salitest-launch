"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAppPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", platform: "android", category: "",
    packageName: "", bundleId: "", testingLink: "", testflightLink: "",
    icon: null, iconPreview: null,
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleIconUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm({
          ...form,
          icon: file,
          iconPreview: event.target?.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("category", form.category);
      formData.append("platform", form.platform);
      if (form.packageName) formData.append("packageName", form.packageName);
      if (form.bundleId) formData.append("bundleId", form.bundleId);
      if (form.testingLink) formData.append("testingLink", form.testingLink);
      if (form.testflightLink) formData.append("testflightLink", form.testflightLink);
      if (form.icon) formData.append("icon", form.icon);

      const res = await fetch("/api/v1/apps", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }

      alert("App registered successfully!");
      router.push("/dashboard/apps");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/apps" className="link link-hover text-sm text-base-content/50 inline-flex items-center gap-1">
        ← Back to Apps
      </Link>

      <div>
        <h2 className="text-xl font-bold">Register New App</h2>
        <p className="text-sm text-base-content/40">Add your app details to start a testing campaign</p>
      </div>

      {/* Steps indicator */}
      <ul className="steps steps-horizontal w-full py-4">
        <li className={`step ${step >= 1 ? "step-primary" : ""}`}>App Details</li>
        <li className={`step ${step >= 2 ? "step-primary" : ""}`}>Platform Config</li>
        <li className={`step ${step >= 3 ? "step-primary" : ""}`}>Testing Setup</li>
      </ul>

      <div className="card bg-base-200 border border-base-content/5">
        <div className="card-body gap-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">App Name</span></label>
                <input className="input input-bordered" placeholder="My Awesome App" value={form.name} onChange={update("name")} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Description</span></label>
                <textarea className="textarea textarea-bordered h-24" placeholder="What does your app do?" value={form.description} onChange={update("description")} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Category</span></label>
                <select className="select select-bordered" value={form.category} onChange={update("category")}>
                  <option value="">Select category</option>
                  {["Games", "Social", "Productivity", "Health & Fitness", "Finance", "Education", "Entertainment", "Food & Drink", "Travel", "Utilities", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">App Icon *</span></label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input type="file" accept="image/*" onChange={handleIconUpload} className="file-input file-input-bordered w-full" />
                    <p className="text-xs text-base-content/40 mt-1">PNG, JPG, GIF (max 5MB)</p>
                  </div>
                  {form.iconPreview && (
                    <div className="flex flex-col items-center gap-2">
                      <img src={form.iconPreview} alt="Icon preview" className="h-20 w-20 rounded-lg border border-base-content/10 object-cover" />
                      <button type="button" onClick={() => setForm({ ...form, icon: null, iconPreview: null })} className="text-xs link link-hover text-error">Remove</button>
                    </div>
                  )}
                </div>
                {!form.icon && <p className="text-xs text-warning mt-2">⚠ Icon is required</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Target Platform</span></label>
                <div className="join w-full">
                  {[["android", "Android"], ["ios", "iOS"], ["both", "Android + iOS"]].map(([val, lbl]) => (
                    <button key={val} className={`btn join-item flex-1 ${form.platform === val ? "btn-primary" : "btn-outline border-base-content/20"}`} onClick={() => setForm({ ...form, platform: val })}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {(form.platform === "android" || form.platform === "both") && (
                <div className="form-control">
                  <label className="label"><span className="label-text">Package Name</span></label>
                  <input className="input input-bordered font-mono text-sm" placeholder="com.example.myapp" value={form.packageName} onChange={update("packageName")} />
                </div>
              )}
              {(form.platform === "ios" || form.platform === "both") && (
                <div className="form-control">
                  <label className="label"><span className="label-text">Bundle ID</span></label>
                  <input className="input input-bordered font-mono text-sm" placeholder="com.example.myapp" value={form.bundleId} onChange={update("bundleId")} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="alert bg-primary/10 border-primary/20 text-sm">
                <div>
                  <h3 className="font-bold">📋 Setup Instructions</h3>
                  <ol className="list-decimal ml-5 mt-2 space-y-1 text-base-content/70">
                    <li>Go to Google Play Console → Testing → Closed Testing</li>
                    <li>Create a new closed test track</li>
                    <li>Copy the opt-in URL and paste it below</li>
                  </ol>
                </div>
              </div>
              {(form.platform === "android" || form.platform === "both") && (
                <div className="form-control">
                  <label className="label"><span className="label-text">Closed Testing Opt-in Link</span></label>
                  <input className="input input-bordered" placeholder="https://play.google.com/apps/testing/..." value={form.testingLink} onChange={update("testingLink")} />
                </div>
              )}
              {(form.platform === "ios" || form.platform === "both") && (
                <div className="form-control">
                  <label className="label"><span className="label-text">TestFlight Link</span></label>
                  <input className="input input-bordered" placeholder="https://testflight.apple.com/join/..." value={form.testflightLink} onChange={update("testflightLink")} />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-4">
            {step > 1 ? (
              <button className="btn btn-outline" onClick={() => setStep(step - 1)}>← Previous</button>
            ) : <div />}
            {step === 1 ? (
              <button 
                className="btn btn-primary" 
                disabled={!form.name || !form.description || !form.category || !form.icon}
                onClick={() => setStep(step + 1)}
              >
                Next →
              </button>
            ) : step < 3 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next →</button>
            ) : (
              <button 
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Registering..." : "✓ Register App"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
