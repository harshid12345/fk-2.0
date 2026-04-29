import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Shield, Sparkles, Users, Calendar, MessageSquare, ArrowRight, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import heroImage from '@/assets/landing-hero.jpg';

const features = [
  { icon: Shield, title: 'WWS Compliance Engine', desc: 'Automatic point calculation and legal max-rent verification for every property.' },
  { icon: Sparkles, title: 'AI Tenant Matching', desc: 'Score every applicant in seconds against your criteria — income, BKR, lifestyle.' },
  { icon: MessageSquare, title: 'Telegram Screener', desc: 'Tenants apply and get screened via a friendly bot. You only see the best fits.' },
  { icon: Calendar, title: 'Smart Scheduling', desc: 'Two-stage viewing flow that respects your availability and fills slots automatically.' },
  { icon: Users, title: 'Applicant Pipeline', desc: 'Track every candidate from first message to signed contract in one clean view.' },
  { icon: Building2, title: 'Kadaster Integration', desc: 'One click pulls property data straight from the Dutch land registry.' },
];

const steps = [
  { n: '01', title: 'Add your property', desc: 'Import via Kadaster or fill in details manually. WWS points calculated automatically.' },
  { n: '02', title: 'Share your invite link', desc: 'Tenants apply through Telegram. The bot screens them against your criteria.' },
  { n: '03', title: 'Pick the best match', desc: 'Review scored applicants, schedule viewings, and close the deal — all in app.' },
];

const testimonials = [
  { name: 'Jan de Vries', role: 'Landlord, Amsterdam · 8 properties', quote: 'Cut my screening time by 80%. The WWS check alone is worth it.' },
  { name: 'Marieke Bakker', role: 'Landlord, Utrecht · 3 properties', quote: 'Finally a tool that takes Dutch rental law seriously. Tenants love the Telegram flow.' },
  { name: 'Pieter Janssen', role: 'Property manager · 22 units', quote: 'The matching algorithm is uncanny. Top applicant has signed every time.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Fair Kamer</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm" className="rounded-full">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-xs font-medium">
              <Sparkles className="w-3 h-3 text-primary" />
              Built for Dutch landlords
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Rent fair.<br />
              <span className="text-primary">Rent smart.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              The all-in-one platform that screens tenants, calculates legal rent, and books viewings — so you can focus on running your portfolio.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-full h-12 px-6">
                  Start free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline" className="rounded-full h-12 px-6">See how it works</Button>
              </a>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> WWS-compliant</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> No credit card</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> EN / NL</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-[2rem] blur-2xl" />
            <img
              src={heroImage}
              alt="Modern Amsterdam rental apartment interior"
              width={1536}
              height={1024}
              className="relative rounded-2xl shadow-2xl object-cover w-full aspect-[4/3]"
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-6 -left-6 bg-card border border-border rounded-2xl p-4 shadow-xl max-w-[200px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium">Match score</span>
              </div>
              <div className="text-2xl font-semibold">92<span className="text-sm text-muted-foreground">/100</span></div>
              <div className="text-xs text-muted-foreground mt-1">Strong match</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Logos / Trust */}
      <section className="border-y border-border bg-muted/40 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Trusted by landlords across the Netherlands</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-sm font-medium text-muted-foreground">
            <span>Amsterdam</span><span>·</span>
            <span>Rotterdam</span><span>·</span>
            <span>Utrecht</span><span>·</span>
            <span>Den Haag</span><span>·</span>
            <span>Eindhoven</span><span>·</span>
            <span>Groningen</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Everything you need to rent the right way.</h2>
            <p className="text-muted-foreground text-lg">From legal compliance to tenant screening, Fair Kamer handles the busywork.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-6 h-full hover:shadow-lg transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-muted/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">From listing to lease in three steps.</h2>
            <p className="text-muted-foreground text-lg">No spreadsheets. No endless email threads. Just clean, compliant rentals.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <Card className="p-8 h-full">
                  <div className="text-5xl font-semibold text-primary/20 mb-4">{s.n}</div>
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Landlords who switched, stayed.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-6 h-full">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-6">"{t.quote}"</p>
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 md:p-16 text-center bg-gradient-to-br from-primary to-secondary text-primary-foreground border-0">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Start renting fairly today.</h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">Free to start. No credit card. Add your first property in under two minutes.</p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="rounded-full h-12 px-8 bg-background text-foreground hover:bg-background/90">
                Get started free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">Fair Kamer</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="mailto:hello@fairkamer.nl" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
