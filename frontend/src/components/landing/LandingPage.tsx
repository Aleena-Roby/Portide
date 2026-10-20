import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PortideLogo } from '../common/PortideLogo';
import { getDefaultDashboardRoute } from '../auth/ProtectedRoute';
import { getStoredSession } from '../../services/api';
import { 
  Anchor, 
  Ship, 
  Compass, 
  Boxes, 
  FileCheck2, 
  Truck, 
  ShieldCheck, 
  BarChart3, 
  Bell, 
  ArrowRight, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  Search,
  Users,
  Layers,
  Building2,
  Menu,
  X
} from 'lucide-react';
import { PublicContainerTracker } from './PublicContainerTracker';

import landingHeroImg from '/landing_hero.jpg';

// Animated Counter Component for Statistics Strip
interface StatCounterProps {
  end: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

const StatCounter: React.FC<StatCounterProps> = ({ end, suffix = '', decimals = 0, duration = 2000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // Cubic ease-out curve for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCount(easedProgress * end);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return (
    <span>
      {decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}
      {suffix}
    </span>
  );
};

export const LandingPage: React.FC = () => {
  const { setGlobalSearchQuery, isAuthenticated, activeRole, logoutUser } = useApp();
  const navigate = useNavigate();

  // Cleanly terminate active dashboard session when returning to or viewing the public landing page
  useEffect(() => {
    if (isAuthenticated || getStoredSession()) {
      logoutUser(true);
    }
  }, [isAuthenticated, logoutUser]);
  
  // Hero Slide State
  const [currentSlide] = useState(0);

  // Scroll detection for Navbar shadow & glass effect
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const slides = [
    {
      badge: 'ENTERPRISE MARITIME PLATFORM',
      headingMain: 'PORTIDE',
      headingSubtitle: 'Intelligent Maritime Port Operations Management Platform',
      description: 'Centralize vessel scheduling, berth allocation, cargo operations, customs clearance, logistics coordination, terminal operations, and gate management through one secure enterprise platform.',
      primaryCta: 'Get Started',
      secondaryCta: 'Login',
      image: landingHeroImg
    }
  ];

  const platformCoreList = [
    {
      icon: Ship,
      title: 'Vessel Scheduling',
      desc: 'Real-time arrival and departure coordination with AI-driven delay prediction.'
    },
    {
      icon: Anchor,
      title: 'Berth Management',
      desc: 'Dynamic allocation based on vessel size, draft, and cargo priority requirements.'
    },
    {
      icon: FileCheck2,
      title: 'Cargo Management',
      desc: 'End-to-end manifest tracking for breakbulk, liquid, and dry bulk commodities.'
    },
    {
      icon: Layers,
      title: 'Container Tracking',
      desc: 'IoT-enabled location monitoring across terminal yards and stacking areas.'
    },
    {
      icon: ShieldCheck,
      title: 'Customs Management',
      desc: 'Automated regulatory compliance filings and digital document verification.'
    },
    {
      icon: Users,
      title: 'Resource Allocation',
      desc: 'Smart dispatch for tugboats, pilots, and terminal equipment operators.'
    },
    {
      icon: Truck,
      title: 'Gate Operations',
      desc: 'Automated OCR and RFID gate systems for seamless truck entry and exit.'
    },
    {
      icon: Bell,
      title: 'Notifications',
      desc: 'Automated multi-channel alerts for critical status changes and alerts.'
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      desc: 'Advanced data visualization for throughput optimization and performance KPIs.'
    }
  ];

  const statisticsList = [
    {
      icon: Ship,
      value: 12000,
      suffix: '+',
      decimals: 0,
      label: 'Registered Vessels'
    },
    {
      icon: Globe,
      value: 450,
      suffix: '+',
      decimals: 0,
      label: 'Shipping Companies'
    },
    {
      icon: Boxes,
      value: 1.8,
      suffix: 'M+',
      decimals: 1,
      label: 'Containers Processed'
    },
    {
      icon: ShieldCheck,
      value: 99.9,
      suffix: '%',
      decimals: 1,
      label: 'Platform Availability'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
      
      {/* 1. MAIN HEADER & NAVIGATION BAR - CLEAN LIGHT DESIGN MATCHING SCREENSHOT */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-md py-3 border-b border-slate-200/80' 
            : 'bg-white/90 backdrop-blur-md py-4 border-b border-slate-200/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 flex items-center justify-between">
          
          {/* Logo on Left */}
          <PortideLogo 
            variant="horizontal" 
            theme="light"
            onClick={() => navigate('/')} 
            className="hover:opacity-95 transition-opacity"
          />

          {/* Desktop Navigation Links in Center */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-[#0b192c]">
            <a 
              href="#hero" 
              className="text-[#0b192c] border-b-2 border-[#0b192c] pb-1 font-extrabold tracking-wider transition-colors"
            >
              HOME
            </a>
            <a 
              href="#platform-core" 
              className="hover:text-[#c88d27] transition-colors py-1"
            >
              PLATFORM
            </a>
            <a 
              href="#ecosystem" 
              className="hover:text-[#c88d27] transition-colors py-1"
            >
              OPERATIONS
            </a>
            <a 
              href="#tracking" 
              className="hover:text-[#c88d27] transition-colors py-1"
            >
              TRACKING
            </a>
            <a 
              href="#contact" 
              className="hover:text-[#c88d27] transition-colors py-1"
            >
              CONTACT
            </a>
          </nav>

          {/* Right Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-7 py-2.5 rounded-full bg-[#c88d27] hover:bg-[#b57e1e] text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-amber-500/20 transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              LOGIN TO PORTIDE
            </button>

            {/* Mobile Menu Toggle Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-900 hover:text-[#c88d27] rounded-lg focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 pt-3 pb-5 space-y-3 animate-fade-in shadow-xl text-slate-900">
            <a 
              href="#hero" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold uppercase tracking-wider text-[#c88d27] py-1"
            >
              HOME
            </a>
            <a 
              href="#platform-core" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#c88d27] py-1"
            >
              PLATFORM
            </a>
            <a 
              href="#ecosystem" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#c88d27] py-1"
            >
              OPERATIONS
            </a>
            <a 
              href="#tracking" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#c88d27] py-1"
            >
              TRACKING
            </a>
            <a 
              href="#contact" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#c88d27] py-1"
            >
              CONTACT
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="block w-full text-left text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#c88d27] py-1"
            >
              LOGIN TO PORTIDE
            </button>
          </div>
        )}
      </header>

      {/* 2. HERO SLIDER BANNER */}
      <section id="hero" className="relative min-h-[640px] lg:min-h-[700px] bg-slate-900 text-white flex items-center overflow-hidden pt-24 lg:pt-28">

        
        {/* Background Image Layer with smooth left-side gradient overlay (50-60% width) */}
        <div className="absolute inset-0 z-0 bg-slate-900">
          <img 
            src={slides[currentSlide].image} 
            alt="PORTIDE Maritime Port Operations" 
            className="w-full h-full object-cover object-center brightness-90 transition-opacity duration-700"
          />
          {/* Smooth dark transparent gradient overlay positioned behind left-side text content */}
          <div 
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ 
              background: 'linear-gradient(to right, rgba(0, 0, 0, 0.70) 0%, rgba(0, 0, 0, 0.50) 45%, rgba(0, 0, 0, 0.15) 75%, rgba(0, 0, 0, 0) 100%)' 
            }}
          />
        </div>

        {/* Hero Content Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Area */}
            <div className="lg:col-span-8 space-y-6 text-left">
              
              {/* Main Headline - Pure White with Subtle Drop Shadow for Superior Readability */}
              <div className="space-y-2 animate-fade-in">
                <span 
                  className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight block"
                  style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.65)' }}
                >
                  PORTIDE
                </span>
                <h1 
                  className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.2]"
                  style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.65)' }}
                >
                  Intelligent Maritime Port Operations Management Platform
                </h1>
              </div>

              {/* Subtitle Description - Softer White with Text Shadow */}
              <p 
                className="text-sm sm:text-base text-slate-100 leading-relaxed font-normal max-w-2xl animate-slide-up"
                style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)' }}
              >
                {slides[currentSlide].description}
              </p>

              {/* Compact Badges - Crisp White Pill Cards */}
              <div className="flex flex-wrap gap-3 pt-1 animate-fade-in">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 border border-slate-200/90 text-[#064e43] text-xs font-bold shadow-md backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 text-[#064e43] shrink-0" />
                  6 Operational Modules
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 border border-slate-200/90 text-[#064e43] text-xs font-bold shadow-md backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 text-[#064e43] shrink-0" />
                  Real-Time Monitoring
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 border border-slate-200/90 text-[#064e43] text-xs font-bold shadow-md backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 text-[#064e43] shrink-0" />
                  Secure Enterprise Platform
                </span>
              </div>

              {/* Action Buttons: Gold Primary CTA & White Secondary Button */}
              <div className="flex items-center gap-4 pt-3 animate-slide-up">
                <button
                  onClick={() => navigate('/register')}
                  className="px-8 py-3.5 rounded-xl bg-[#c88d27] hover:bg-[#b57e1e] text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-amber-500/25 transition-all duration-200 border border-[#c88d27] cursor-pointer flex items-center gap-2"
                >
                  <span>{slides[currentSlide].primaryCta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-7 py-3.5 text-xs font-bold text-[#064e43] hover:bg-slate-50 bg-white border border-slate-200 rounded-xl transition-all duration-200 cursor-pointer shadow-md"
                >
                  {slides[currentSlide].secondaryCta}
                </button>
              </div>

            </div>

          </div>
        </div>

      </section>

      {/* 3. STATISTICS SECTION */}
      <section id="statistics" className="relative z-20 py-10 bg-[#f8fafc] border-y border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {statisticsList.map((stat, idx) => {
              const StatIcon = stat.icon;
              return (
                <div 
                  key={idx}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-4 hover:border-[#064e43]/40 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#064e43]/10 border border-[#064e43]/20 text-[#064e43] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <StatIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-[#c88d27] tracking-tight">
                      <StatCounter 
                        end={stat.value} 
                        suffix={stat.suffix} 
                        decimals={stat.decimals} 
                      />
                    </div>
                    <div className="text-xs font-bold text-slate-700 mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. PLATFORM CORE SECTION */}
      <section id="platform-core" className="py-20 bg-slate-50 border-b border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#064e43] block mb-3">
              PLATFORM CORE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#08192d]">
              Comprehensive Port Infrastructure Control
            </h2>
            <div className="w-16 h-1 bg-[#c88d27] mt-6 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformCoreList.map((svc, idx) => {
              const IconComp = svc.icon;
              return (
                <div 
                  key={idx}
                  className="p-8 rounded-2xl bg-white shadow-sm border border-slate-200/90 flex flex-col justify-between hover:-translate-y-1.5 hover:border-[#064e43]/50 hover:shadow-lg transition-all duration-300 group h-full"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[#064e43]/10 border border-[#064e43]/20 flex items-center justify-center text-[#064e43] mb-6 group-hover:bg-[#064e43] group-hover:text-white transition-all duration-300">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-black text-[#08192d] mb-2.5 group-hover:text-[#064e43] transition-colors">
                      {svc.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                      {svc.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 5. USER ROLES SECTION */}
      <section id="ecosystem" className="py-20 bg-white border-b border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#064e43] block mb-3">
              PORTIDE USER ROLES
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#08192d]">
              PORTIDE User Roles
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'admin', name: 'Port Admin', desc: 'Full operational visibility, platform configuration, and high-level performance management.', icon: ShieldCheck },
              { id: 'shipping_company', name: 'Shipping Agent', desc: 'Manage vessel bookings, manifest submissions, and port service requests.', icon: Ship },
              { id: 'terminal_operator', name: 'Terminal Operator', desc: 'Coordinate yard operations, equipment dispatch, and container movements.', icon: Boxes },
              { id: 'customs_officer', name: 'Customs Officer', desc: 'Review clearance status, audit documentation, and authorize cargo release.', icon: FileCheck2 },
              { id: 'gate_officer', name: 'Transporter', desc: 'Gate appointments, e-delivery orders, and real-time terminal entry status.', icon: Truck },
              { id: 'operations_officer', name: 'Harbor Master', desc: 'Control marine traffic, anchorage zones, and safety compliance protocols.', icon: Compass }
            ].map(r => {
              const RoleIcon = r.icon;
              return (
                <div
                  key={r.id}
                  className="p-8 rounded-2xl bg-slate-50 shadow-sm border border-slate-200/90 hover:-translate-y-1.5 hover:border-[#064e43]/50 hover:shadow-lg transition-all duration-300 group h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#064e43]/10 border border-[#064e43]/20 text-[#064e43] flex items-center justify-center shrink-0 group-hover:bg-[#064e43] group-hover:text-white transition-all duration-300">
                        <RoleIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-black text-[#08192d] group-hover:text-[#064e43] transition-colors">{r.name}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">{r.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. QUICK SHIPMENT & MANIFEST TRACKER SECTION */}
      <section id="tracking" className="py-16 bg-slate-100 text-slate-900 border-y border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PublicContainerTracker />
        </div>
      </section>

      {/* 7. FOOTER SECTION */}
      <footer id="contact" className="bg-white text-slate-900 pt-16 pb-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-xs text-slate-600">
            
            {/* Column 1: Brand Info */}
            <div className="space-y-4">
              <PortideLogo 
                variant="horizontal" 
                theme="light" 
                onClick={() => navigate('/')} 
                className="hover:opacity-95 transition-opacity"
              />
              <p className="leading-relaxed text-slate-600 font-medium">
                Intelligent maritime port operations platform providing real-time vessel scheduling, berth allocations, e-customs EDI manifest approvals, and RFID gate logistics.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#08192d] mb-4">Quick Links</h4>
              <ul className="space-y-2.5 font-medium">
                <li><a href="#hero" className="hover:text-[#064e43] transition-colors">Home</a></li>
                <li><a href="#platform-core" className="hover:text-[#064e43] transition-colors">Platform Core</a></li>
                <li><a href="#ecosystem" className="hover:text-[#064e43] transition-colors">User Roles</a></li>
                <li><a href="#tracking" className="hover:text-[#064e43] transition-colors">Container Tracking</a></li>
              </ul>
            </div>

            {/* Column 3: Operations Modules */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#08192d] mb-4">Modules</h4>
              <ul className="space-y-2.5 font-medium">
                <li><span>Road & Gate Operations</span></li>
                <li><span>Vessel & Berth Allocation</span></li>
                <li><span>EDI e-Customs Clearance</span></li>
                <li><span>Yard & Cargo Telemetry</span></li>
              </ul>
            </div>

            {/* Column 4: Contact Details */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#08192d] mb-4">Contact Us</h4>
              <ul className="space-y-2.5 font-medium">
                <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#064e43] shrink-0" /> Terminal 01, Port Operations Center</li>
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#064e43] shrink-0" /> +1 (800) PORTIDE</li>
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#064e43] shrink-0" /> support@portide.io</li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
            <div>
              © {new Date().getFullYear()} PORTIDE Platform. All Rights Reserved.
            </div>
            <div className="flex items-center gap-4">
              <a href="#privacy" className="hover:text-[#064e43] transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="#terms" className="hover:text-[#064e43] transition-colors">Terms & Conditions</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};
