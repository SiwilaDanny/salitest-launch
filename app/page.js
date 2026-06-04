"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="bg-base-300 min-h-screen">
      {/* ═══════ NAVBAR ═══════ */}
      <div className="navbar bg-base-200/80 backdrop-blur-lg sticky top-0 z-50 border-b border-base-content/5 max-w-7xl mx-auto">
        <div className="navbar-start">
          <Link href="/" className="text-xl font-extrabold text-gradient">SaLiTeSt Launch</Link>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal gap-1 text-sm">
            <li><a href="#how" className="text-base-content/60 hover:text-base-content">How It Works</a></li>
            <li><a href="#features" className="text-base-content/60 hover:text-base-content">Features</a></li>
            <li><a href="#pricing" className="text-base-content/60 hover:text-base-content">Pricing</a></li>
          </ul>
        </div>
        <div className="navbar-end gap-2">
          <Link href="/login" className="btn btn-ghost btn-sm">Log In</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </div>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative z-10">
          <div className="badge badge-primary badge-outline gap-1 mb-6 text-xs font-semibold">
            ⚡ Trusted by 500+ Developers
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            Get Real Testers.<br />
            <span className="text-gradient">Launch With Confidence.</span>
          </h1>
          <p className="text-lg text-base-content/50 max-w-xl mx-auto leading-relaxed mb-10">
            Meet Google Play&apos;s 12-tester closed testing requirement and Apple&apos;s TestFlight review
            with verified, fraud-free testers. Go from beta to published in 14 days.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/register?role=developer" className="btn btn-primary">
              I&apos;m a Developer →
            </Link>
            <Link href="/register?role=tester" className="btn btn-outline">
              I&apos;m a Tester →
            </Link>
          </div>

          {/* Trust stats */}
          <div className="flex gap-12 justify-center mt-16 flex-wrap">
            {[
              ["12+", "Verified Testers Per Campaign"],
              ["14", "Day Testing Guarantee"],
              ["99%", "Fraud Prevention Rate"],
            ].map(([val, label]) => (
              <div key={val} className="text-center">
                <div className="text-3xl font-black text-gradient">{val}</div>
                <div className="text-xs text-base-content/40 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how" className="py-24 bg-base-200">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">How It Works</h2>
          <p className="text-base-content/50 text-lg mb-12">Three simple steps to get your app store-ready</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { num: "01", icon: "🚀", title: "Submit Your App", desc: "Upload your app details, set your platform (Android/iOS), and create a testing campaign with your requirements." },
              { num: "02", icon: "👥", title: "We Match Testers", desc: "Our platform matches you with verified, fraud-screened testers who opt-in to your closed testing track for 14 days." },
              { num: "03", icon: "🛡️", title: "Launch Verified", desc: "After 14 days of verified testing with real feedback, apply for production access with full confidence." },
            ].map((step) => (
              <div key={step.num} className="card bg-base-100 border border-base-content/5 hover:border-primary/30 transition-all duration-200">
                <div className="card-body relative">
                  <span className="absolute top-4 right-5 text-5xl font-black text-base-content/5">{step.num}</span>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl mb-2">
                    {step.icon}
                  </div>
                  <h3 className="card-title text-lg">{step.title}</h3>
                  <p className="text-sm text-base-content/50 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">Why SaLiTeSt Launch?</h2>
          <p className="text-base-content/50 text-lg mb-12">Built-in fraud prevention that protects your store accounts</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "🛡️", title: "5-Layer Fraud Prevention", desc: "Device fingerprinting, network analysis, behavioral tracking, engagement verification, and trust scoring." },
              { icon: "👥", title: "Verified Real Testers", desc: "Every tester is identity-verified with phone OTP. No bots, no farms, no fake accounts." },
              { icon: "✓", title: "Play Store Compliant", desc: "Designed around Google's 12-tester / 14-day closed testing requirement for new personal accounts." },
              { icon: "⭐", title: "Quality Feedback", desc: "Testers provide structured feedback with ratings, bug reports, and suggestions — not just empty installs." },
              { icon: "⚡", title: "Real-Time Tracking", desc: "Monitor tester opt-ins, daily activity, and 14-day countdown in real-time from your dashboard." },
              { icon: "🚀", title: "TestFlight Ready", desc: "Full support for Apple TestFlight distribution with external beta review guidance." },
            ].map((f) => (
              <div key={f.title} className="card bg-base-200 border border-base-content/5 hover:border-secondary/20 transition-all duration-200 text-left">
                <div className="card-body gap-1">
                  <span className="text-2xl mb-1">{f.icon}</span>
                  <h3 className="font-bold">{f.title}</h3>
                  <p className="text-sm text-base-content/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="py-24 bg-base-200">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">Simple, Transparent Pricing</h2>
          <p className="text-base-content/50 text-lg mb-12">Start free as a tester. Developers pay only for what they need.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Starter", price: "$29", period: "/campaign", desc: "Perfect for indie developers",
                features: ["12 verified testers", "14-day testing period", "Basic fraud protection", "Email support", "Feedback reports"],
                cta: "Get Started", highlight: false
              },
              {
                name: "Pro", price: "$79", period: "/campaign", desc: "For growing teams",
                features: ["30 verified testers", "14-day testing period", "Advanced fraud prevention", "Priority tester matching", "Real-time analytics", "Priority support"],
                cta: "Go Pro", highlight: true
              },
              {
                name: "Enterprise", price: "Custom", period: "", desc: "For agencies & studios",
                features: ["Unlimited testers", "Custom duration", "Dedicated fraud review", "Account manager", "API access", "SLA guarantee"],
                cta: "Contact Sales", highlight: false
              },
            ].map((plan) => (
              <div key={plan.name} className={`card bg-base-100 border ${plan.highlight ? "border-primary shadow-lg shadow-primary/10" : "border-base-content/5"} relative`}>
                {plan.highlight && (
                  <div className="badge badge-primary badge-sm absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</div>
                )}
                <div className="card-body text-left">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-xs text-base-content/40">{plan.desc}</p>
                  <div className="flex items-baseline gap-1 my-4">
                    <span className="text-4xl font-black">{plan.price}</span>
                    <span className="text-sm text-base-content/40">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-base-content/60">
                        <span className="text-success text-xs">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register?role=developer" className={`btn w-full ${plan.highlight ? "btn-primary" : "btn-outline"}`}>
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight mb-4">Ready to Launch?</h2>
          <p className="text-base-content/50 mb-8">
            Join hundreds of developers who&apos;ve successfully published their apps through verified testing.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg">
            Start Your Campaign →
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-base-content/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center flex-wrap gap-4">
          <span className="font-bold text-gradient">SaLiTeSt Launch</span>
          <p className="text-xs text-base-content/30">
            © {new Date().getFullYear()} SaLiTeSt Launch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
