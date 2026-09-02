import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import {
  createRoot
} from "react-dom/client";

import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  Save,
  Sprout,
  UserRound,
  X,
  Sparkles,
  Timer,
  IndianRupee,
  Warehouse
} from "lucide-react";

import "./styles.css";

import {
  AdminLogin,
  AdminDashboard,
  Procurement,
  Farmers as AdminFarmers,
  Centres,
  Queue as AdminQueue,
  CropTypes,
  Prices,
  Transactions,
  SettingsPage
} from "./admin/AdminApp.jsx";


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API = "http://localhost:4000/api";

async function api(path, opts = {}) {
  const response = await fetch(
    API + path,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {})
      },
      ...opts
    }
  );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Request failed"
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| TRANSLATIONS
|--------------------------------------------------------------------------
*/

const translations = {
  en: {
    name: "English",
    welcome: "Welcome",
    dashboard: "Farmer Dashboard",
    profile: "My Profile",
    crops: "My Crops",
    register: "Register Crop",
    language: "Language",
    next: "Next",
    back: "Back",
    confirm: "Confirm Registration",
    save: "Save Changes",
    logout: "Logout",
    step1: "Select Crop",
    step2: "Enter Quantity",
    step3: "Select Location",
    step4: "Expected Date",
    step5: "Confirm",
    crop: "Crop",
    variety: "Crop Variety",
    quantity: "Quantity (kg)",
    harvest: "Harvest Date",
    expected: "Expected Procurement Date",
    location: "Location",
    district: "District",
    village: "Village",
    phone: "Mobile Number",
    empty: "No crops registered yet.",
    start: "Register your first crop",
    success: "Crop registered successfully!",
    details: "Crop Details",
    journey: "Registration Journey",
    choose: "Choose the crop you want to register.",
    enterQty: "Tell us how much you expect to procure.",
    chooseLocation: "Where is the crop located?",
    chooseDate: "When should procurement be expected?",
    review: "Review and confirm your crop details.",
    select: "Select",
    profileTitle: "Farmer Profile",
    profileSub: "Keep your farmer and location details up to date.",
    languageSub: "Choose the language used across the farmer portal.",
    aiRecommendations: "AI Recommendations",
    aiSub: "Find the best procurement centre and slot using AI-powered demand, queue and price analysis.",
    getRecommendations: "Get AI Recommendations",
    bestRecommendation: "Best Recommendation",
    predictedWait: "Predicted Wait",
    capacity: "Available Capacity",
    price: "Price",
    trend: "Price Trend",
    book: "Book This Slot",
    booking: "Booking...",
    bookingSuccess: "Booking created successfully!",
    token: "Token Number",
    bookingDate: "Booking Date",
    recommendationScore: "Recommendation Score",
    noRecommendation: "No recommendations available.",
    noRecommendationText: "There are currently no available centre and slot combinations for the selected date.",
    selectCrop: "Select a crop",
    selectDate: "Select procurement date",
    aiPowered: "AI POWERED",
    centre: "Procurement Centre",
    slot: "Time Slot",
    queue: "My Queue",
    liveQueue: "Live Queue Monitoring",
    nowServing: "Now Serving",
    yourPosition: "Your Position",
    estimatedWait: "Estimated Wait",
    queueStatus: "Queue Status",
    activeQueue: "Active Queue",
    refreshQueue: "Queue updates automatically every 10 seconds.",
    noQueue: "You are not currently in an active queue.",
    viewQueue: "View Live Queue",
    bookedGoQueue: "Go to Live Queue"
  },

  te: {
    name: "తెలుగు",
    welcome: "స్వాగతం",
    dashboard: "రైతు డాష్‌బోర్డ్",
    profile: "నా ప్రొఫైల్",
    crops: "నా పంటలు",
    register: "పంట నమోదు",
    language: "భాష",
    next: "తదుపరి",
    back: "వెనుకకు",
    confirm: "నమోదును నిర్ధారించండి",
    save: "మార్పులను సేవ్ చేయండి",
    logout: "లాగ్ అవుట్",
    step1: "పంట ఎంచుకోండి",
    step2: "పరిమాణం నమోదు",
    step3: "స్థానం ఎంచుకోండి",
    step4: "అంచనా తేదీ",
    step5: "నిర్ధారించండి",
    crop: "పంట",
    variety: "పంట రకం",
    quantity: "పరిమాణం (కిలోలు)",
    harvest: "కోత తేదీ",
    expected: "అంచనా సేకరణ తేదీ",
    location: "స్థానం",
    district: "జిల్లా",
    village: "గ్రామం",
    phone: "మొబైల్ నంబర్",
    empty: "ఇంకా పంటలు నమోదు కాలేదు.",
    start: "మొదటి పంటను నమోదు చేయండి",
    success: "పంట విజయవంతంగా నమోదైంది!",
    details: "పంట వివరాలు",
    journey: "నమోదు ప్రయాణం",
    choose: "మీరు నమోదు చేయాలనుకునే పంటను ఎంచుకోండి.",
    enterQty: "సేకరించాల్సిన పంట పరిమాణాన్ని నమోదు చేయండి.",
    chooseLocation: "పంట ఉన్న స్థలం ఎక్కడ?",
    chooseDate: "సేకరణ ఎప్పుడు కావాలి?",
    review: "మీ పంట వివరాలను పరిశీలించి నిర్ధారించండి.",
    select: "ఎంచుకోండి",
    profileTitle: "రైతు ప్రొఫైల్",
    profileSub: "మీ రైతు మరియు స్థల వివరాలను నవీకరించండి.",
    languageSub: "రైతు పోర్టల్‌లో ఉపయోగించే భాషను ఎంచుకోండి.",
    aiRecommendations: "AI సిఫార్సులు",
    aiSub: "AI ద్వారా ఉత్తమ సేకరణ కేంద్రం మరియు సమయాన్ని కనుగొనండి.",
    getRecommendations: "AI సిఫార్సులు పొందండి",
    bestRecommendation: "ఉత్తమ సిఫార్సు",
    predictedWait: "అంచనా వేచి ఉండే సమయం",
    capacity: "అందుబాటులో ఉన్న సామర్థ్యం",
    price: "ధర",
    trend: "ధర ధోరణి",
    book: "ఈ స్లాట్ బుక్ చేయండి",
    booking: "బుక్ చేస్తున్నారు...",
    bookingSuccess: "బుకింగ్ విజయవంతంగా సృష్టించబడింది!",
    token: "టోకెన్ నంబర్",
    bookingDate: "బుకింగ్ తేదీ",
    recommendationScore: "సిఫార్సు స్కోర్",
    noRecommendation: "సిఫార్సులు అందుబాటులో లేవు.",
    noRecommendationText: "ఎంచుకున్న తేదీకి కేంద్రం మరియు స్లాట్ అందుబాటులో లేవు.",
    selectCrop: "పంటను ఎంచుకోండి",
    selectDate: "సేకరణ తేదీని ఎంచుకోండి",
    aiPowered: "AI POWERED",
    centre: "సేకరణ కేంద్రం",
    slot: "సమయ స్లాట్",
    queue: "నా క్యూ",
    liveQueue: "లైవ్ క్యూ పర్యవేక్షణ",
    nowServing: "ప్రస్తుతం సేవలు",
    yourPosition: "మీ స్థానం",
    estimatedWait: "అంచనా వేచి ఉండే సమయం",
    queueStatus: "క్యూ స్థితి",
    activeQueue: "క్రియాశీల క్యూ",
    refreshQueue: "ప్రతి 10 సెకన్లకు క్యూ నవీకరించబడుతుంది.",
    noQueue: "ప్రస్తుతం మీరు క్రియాశీల క్యూలో లేరు.",
    viewQueue: "లైవ్ క్యూ చూడండి",
    bookedGoQueue: "లైవ్ క్యూకి వెళ్లండి"
  },

  hi: {
    name: "हिन्दी",
    welcome: "स्वागत है",
    dashboard: "किसान डैशबोर्ड",
    profile: "मेरी प्रोफ़ाइल",
    crops: "मेरी फसलें",
    register: "फसल पंजीकरण",
    language: "भाषा",
    next: "आगे",
    back: "पीछे",
    confirm: "पंजीकरण की पुष्टि करें",
    save: "बदलाव सेव करें",
    logout: "लॉग आउट",
    step1: "फसल चुनें",
    step2: "मात्रा दर्ज करें",
    step3: "स्थान चुनें",
    step4: "अपेक्षित तारीख",
    step5: "पुष्टि करें",
    crop: "फसल",
    variety: "फसल किस्म",
    quantity: "मात्रा (किग्रा)",
    harvest: "कटाई की तारीख",
    expected: "अपेक्षित खरीद तारीख",
    location: "स्थान",
    district: "जिला",
    village: "गाँव",
    phone: "मोबाइल नंबर",
    empty: "अभी कोई फसल पंजीकृत नहीं है।",
    start: "पहली फसल पंजीकृत करें",
    success: "फसल सफलतापूर्वक पंजीकृत हुई!",
    details: "फसल विवरण",
    journey: "पंजीकरण यात्रा",
    choose: "वह फसल चुनें जिसे आप पंजीकृत करना चाहते हैं।",
    enterQty: "अपेक्षित खरीद की मात्रा बताएं।",
    chooseLocation: "फसल कहाँ स्थित है?",
    chooseDate: "खरीद कब अपेक्षित है?",
    review: "अपनी फसल की जानकारी जाँचें और पुष्टि करें।",
    select: "चुनें",
    profileTitle: "किसान प्रोफ़ाइल",
    profileSub: "अपने किसान और स्थान विवरण अपडेट रखें।",
    languageSub: "किसान पोर्टल में उपयोग की जाने वाली भाषा चुनें।",
    aiRecommendations: "AI सिफारिशें",
    aiSub: "AI की मदद से सर्वोत्तम खरीद केंद्र और स्लॉट खोजें।",
    getRecommendations: "AI सिफारिशें प्राप्त करें",
    bestRecommendation: "सर्वोत्तम सिफारिश",
    predictedWait: "अनुमानित प्रतीक्षा",
    capacity: "उपलब्ध क्षमता",
    price: "कीमत",
    trend: "कीमत रुझान",
    book: "यह स्लॉट बुक करें",
    booking: "बुकिंग...",
    bookingSuccess: "बुकिंग सफलतापूर्वक बनाई गई!",
    token: "टोकन नंबर",
    bookingDate: "बुकिंग तारीख",
    recommendationScore: "सिफारिश स्कोर",
    noRecommendation: "कोई सिफारिश उपलब्ध नहीं है।",
    noRecommendationText: "चयनित तारीख के लिए कोई केंद्र और स्लॉट उपलब्ध नहीं है।",
    selectCrop: "फसल चुनें",
    selectDate: "खरीद तारीख चुनें",
    aiPowered: "AI POWERED",
    centre: "खरीद केंद्र",
    slot: "समय स्लॉट",
    queue: "मेरी कतार",
    liveQueue: "लाइव कतार निगरानी",
    nowServing: "अभी सेवा",
    yourPosition: "आपकी स्थिति",
    estimatedWait: "अनुमानित प्रतीक्षा",
    queueStatus: "कतार स्थिति",
    activeQueue: "सक्रिय कतार",
    refreshQueue: "कतार हर 10 सेकंड में अपने आप अपडेट होती है।",
    noQueue: "आप वर्तमान में किसी सक्रिय कतार में नहीं हैं।",
    viewQueue: "लाइव कतार देखें",
    bookedGoQueue: "लाइव कतार पर जाएँ"
  }
};

function useT(lang) {
  return translations[lang] || translations.en;
}


/*
|--------------------------------------------------------------------------
| AUTH CONTEXT
|--------------------------------------------------------------------------
*/

const Auth = createContext(null);

function AuthProvider({
  children
}) {
  const [
    farmer,
    setFarmer
  ] = useState(null);

  const [
    user,
    setUser
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    lang,
    setLang
  ] = useState(
    localStorage.getItem("sp_lang") ||
    "en"
  );

  useEffect(() => {
    api("/auth/me")
      .then(data => {
        setUser(data.user);

        if (data.farmer) {
          setFarmer(data.farmer);

          setLang(
            data.farmer.preferred_language ||
            data.farmer.preferredLanguage ||
            "en"
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "sp_lang",
      lang
    );
  }, [lang]);

  const logout = async () => {
    await api(
      "/auth/logout",
      {
        method: "POST"
      }
    ).catch(() => {});

    setUser(null);
    setFarmer(null);
  };

  return (
    <Auth.Provider
      value={{
        farmer,
        setFarmer,
        user,
        setUser,
        loading,
        lang,
        setLang,
        logout
      }}
    >
      {children}
    </Auth.Provider>
  );
}

const useAuth = () =>
  useContext(Auth);


/*
|--------------------------------------------------------------------------
| SHARED COMPONENTS
|--------------------------------------------------------------------------
*/

function Logo() {
  return (
    <Link
      to="/farmer/dashboard"
      className="logo"
    >
      <span>
        <Leaf size={18}/>
      </span>

      <b>
        Smart
        <span>Procure</span>
      </b>
    </Link>
  );
}

function LanguageSwitcher() {
  const {
    lang,
    setLang
  } = useAuth();

  return (
    <div className="lang">
      <Globe2 size={15}/>

      <select
        value={lang}
        onChange={e =>
          setLang(e.target.value)
        }
      >
        <option value="en">
          English
        </option>

        <option value="te">
          తెలుగు
        </option>

        <option value="hi">
          हिन्दी
        </option>
      </select>
    </div>
  );
}

function Header() {
  const {
    farmer,
    logout,
    lang
  } = useAuth();

  const [
    open,
    setOpen
  ] = useState(false);

  const t = useT(lang);

  return (
    <header>
      <div className="topbar">

        <Logo/>

        <button
          className="hamb"
          onClick={() =>
            setOpen(!open)
          }
        >
          {open
            ? <X/>
            : <Menu/>
          }
        </button>

        <nav
          className={
            open ? "open" : ""
          }
        >

          <Link to="/farmer/dashboard">
            {t.dashboard}
          </Link>

          <Link to="/farmer/crops">
            {t.crops}
          </Link>

          <Link to="/farmer/recommendations">
            {t.aiRecommendations}
          </Link>

          <Link to="/farmer/queue">
            {t.queue}
          </Link>

          <Link to="/farmer/profile">
            {t.profile}
          </Link>

          <LanguageSwitcher/>

          {farmer && (
            <button
              className="logout"
              onClick={() =>
                logout().then(
                  () =>
                    location.href =
                      "/farmer/login"
                )
              }
            >
              <LogOut size={14}/>
              {t.logout}
            </button>
          )}

        </nav>
      </div>
    </header>
  );
}

function Protected({
  children
}) {
  const {
    farmer,
    loading
  } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        Loading…
      </div>
    );
  }

  if (!farmer) {
    return (
      <Navigate
        to="/farmer/login"
        replace
      />
    );
  }

  return children;
}


/*
|--------------------------------------------------------------------------
| AUTH PAGES
|--------------------------------------------------------------------------
*/

function AuthPage({
  signup = false
}) {
  const {
    setFarmer,
    setUser,
    setLang
  } = useAuth();

  const nav =
    useNavigate();

  const [
    form,
    setForm
  ] = useState(
    signup
      ? {
          name: "",
          mobile: ""
        }
      : {
          name: "",
          mobile: ""
        }
  );

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  async function submit(e) {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      const data =
        await api(
          signup
            ? "/auth/signup"
            : "/auth/login",
          {
            method: "POST",
            body: JSON.stringify(form)
          }
        );

      setUser(data.user);

      if (data.farmer) {
        setFarmer(data.farmer);

        setLang(
          data.farmer.preferred_language ||
          "en"
        );

        nav(
          "/farmer/dashboard"
        );
      } else if (
        data.user.role === "ADMIN"
      ) {
        nav("/admin");
      } else {
        nav(
          "/farmer/dashboard"
        );
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">

      <div className="login-art">

        <Logo/>

        <div>

          <span className="eyebrow">
            SECURE ACCESS • PHASES 1–4
          </span>

          <h1>
            {signup ? (
              <>
                Start your
                <br/>
                <em>
                  farmer journey.
                </em>
              </>
            ) : (
              <>
                Procurement,
                <br/>
                <em>
                  made smarter.
                </em>
              </>
            )}
          </h1>

          <p>
            {signup
              ? "Register with your name and mobile number, then continue into crop registration and procurement workflows."
              : "Enter the same name and mobile number you used during farmer registration."
            }
          </p>

        </div>

        <div className="art-orbit">
          {signup
            ? <Sprout/>
            : <LockKeyhole/>
          }
        </div>

      </div>

      <div className="login-form">

        <div className="login-box">

          <span className="eyebrow">
            {signup
              ? "FARMER ONBOARDING"
              : "ACCOUNT LOGIN"
            }
          </span>

          <h2>
            {signup
              ? "Register as a farmer"
              : "Farmer login"
            }
          </h2>

          <p>
            {signup
              ? "Only your name and mobile number are required."
              : "Use your registered farmer name and mobile number."
            }
          </p>

          <form onSubmit={submit}>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            {signup ? (
              <>
                <label>
                  Full name
                  <input
                    required
                    value={form.name}
                    onChange={e =>
                      setForm({
                        ...form,
                        name:
                          e.target.value
                      })
                    }
                    placeholder="Your full name"
                  />
                </label>

                <label>
                  Mobile number
                  <input
                    required
                    value={form.mobile}
                    onChange={e =>
                      setForm({
                        ...form,
                        mobile:
                          e.target.value
                      })
                    }
                    placeholder="10-digit mobile"
                  />
                </label>

                <div className="demo-note">
                  <UserRound size={14}/>
                  Your name and mobile number are your farmer login details.
                </div>
              </>
            ) : (
              <>
                <label>
                  Farmer name
                  <input
                    required
                    value={form.name}
                    onChange={e =>
                      setForm({
                        ...form,
                        name: e.target.value
                      })
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                </label>

                <label>
                  Mobile number
                  <input
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={form.mobile}
                    onChange={e =>
                      setForm({
                        ...form,
                        mobile: e.target.value.replace(/\D/g, "").slice(0, 10)
                      })
                    }
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                  />
                </label>
              </>
            )}

            <button
              className="btn primary full"
              disabled={busy}
            >
              {busy
                ? (
                  signup
                    ? "Registering…"
                    : "Signing in…"
                )
                : (
                  signup
                    ? "Register Farmer"
                    : "Login"
                )}

              <ArrowRight size={16}/>
            </button>

          </form>

          <div className="auth-links">

            {signup ? (
              <span>
                Already have an account?
                {" "}
                <Link to="/login">
                  Login
                </Link>
              </span>
            ) : (
              <span>
                New farmer?
                {" "}
                <Link to="/signup">
                  Register here
                </Link>
              </span>
            )}

            <Link
              className="admin-back"
              to="/admin/login"
            >
              Admin Command Centre →
            </Link>

          </div>

        </div>

      </div>
    </div>
  );
}

function Login() {
  return <AuthPage/>;
}

function Signup() {
  return (
    <AuthPage signup/>
  );
}

function Forgot() {
  const [
    identifier,
    setIdentifier
  ] = useState("");

  const [
    message,
    setMessage
  ] = useState("");

  const [
    error,
    setError
  ] = useState("");

  async function submit(e) {
    e.preventDefault();

    try {
      const data =
        await api(
          "/auth/forgot-password",
          {
            method: "POST",
            body: JSON.stringify({
              identifier
            })
          }
        );

      setMessage(data.message);
      setError("");

    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-page">

      <div className="login-art">

        <Logo/>

        <div>

          <span className="eyebrow">
            ACCOUNT RECOVERY
          </span>

          <h1>
            Back to
            <br/>
            <em>
              your workspace.
            </em>
          </h1>

          <p>
            Use your registered email or mobile number to start the recovery process.
          </p>

        </div>

        <div className="art-orbit">
          <LockKeyhole/>
        </div>

      </div>

      <div className="login-form">

        <div className="login-box">

          <span className="eyebrow">
            PASSWORD RESET
          </span>

          <h2>
            Reset your password
          </h2>

          <p>
            Enter your registered email or mobile number.
          </p>

          <form onSubmit={submit}>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            {message && (
              <div className="success">
                {message}
              </div>
            )}

            <label>
              Email / Mobile
              <input
                required
                value={identifier}
                onChange={e =>
                  setIdentifier(
                    e.target.value
                  )
                }
                placeholder="you@example.com"
              />
            </label>

            <button className="btn primary full">
              Continue
              <ArrowRight size={16}/>
            </button>

          </form>

          <Link
            className="admin-back"
            to="/login"
          >
            ← Back to login
          </Link>

        </div>

      </div>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| FARMER LAYOUT
|--------------------------------------------------------------------------
*/

function Layout({
  children
}) {
  return (
    <>
      <Header/>

      <main className="main">
        {children}
      </main>
    </>
  );
}


/*
|--------------------------------------------------------------------------
| FARMER DASHBOARD
|--------------------------------------------------------------------------
*/

function Dashboard() {
  const {
    farmer,
    lang
  } = useAuth();

  const t =
    useT(lang);

  const [
    crops,
    setCrops
  ] = useState([]);

  useEffect(() => {
    api("/farmer/crops")
      .then(data =>
        setCrops(data.crops)
      )
      .catch(() => {});
  }, []);

  return (
    <Layout>

      <div className="page-head">

        <div>

          <span className="eyebrow">
            FARMER PORTAL
          </span>

          <h1>
            {t.welcome},{" "}
            {farmer.name.split(" ")[0]}
            {" "}
            <span>🌾</span>
          </h1>

          <p>
            {t.details} and procurement journey, in one simple place.
          </p>

        </div>

        <LanguageSwitcher/>

      </div>

      <div className="hero-panel">

        <div>

          <span className="eyebrow">
            YOUR NEXT STEP
          </span>

          <h2>
            {crops.length
              ? `You have ${crops.length} registered crop${crops.length > 1 ? "s" : ""}.`
              : "Register your crop to get started."
            }
          </h2>

          <p>
            {crops.length
              ? "Your crop data is ready for AI recommendations and the next procurement phases."
              : "Tell us about your crop through a short five-step guided wizard."
            }
          </p>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap"
            }}
          >

            <Link
              className="btn light"
              to="/farmer/crops/new"
            >
              {t.register}
              <ArrowRight size={15}/>
            </Link>

            {crops.length > 0 && (
              <Link
                className="btn light"
                to="/farmer/recommendations"
              >
                <Sparkles size={15}/>
                {t.aiRecommendations}
              </Link>
            )}

            <Link
              className="btn light"
              to="/farmer/queue"
            >
              <Timer size={15}/>
              {t.viewQueue}
            </Link>

          </div>

        </div>

        <div className="hero-leaf">
          <Sprout/>
        </div>

      </div>

      <div className="section-title">

        <div>

          <span className="eyebrow">
            {t.journey}
          </span>

          <h2>
            A simple path from crop to procurement
          </h2>

        </div>

      </div>

      <div className="journey-cards">

        {[
          [1, t.step1, Leaf],
          [2, t.step2, Check],
          [3, t.step3, MapPin],
          [4, t.step4, CalendarDays],
          [5, t.step5, CheckCircle2]
        ].map(
          ([number, label, Icon]) => (
            <div
              className="journey-card"
              key={number}
            >

              <div>
                <small>
                  0{number}
                </small>

                <Icon/>
              </div>

              <b>
                {label}
              </b>

              <span>
                {number === 1
                  ? "Start here"
                  : number === 5
                    ? "Review"
                    : "Next"
                }
              </span>

            </div>
          )
        )}

      </div>

      <div className="dashboard-grid">

        <section className="panel">

          <div className="panel-title">

            <div>
              <span className="eyebrow">
                {t.crops}
              </span>

              <h2>
                Recent registrations
              </h2>
            </div>

            <Link to="/farmer/crops">
              View all
              <ChevronRight size={15}/>
            </Link>

          </div>

          {crops.length === 0
            ? <Empty/>
            : (
              <div className="crop-list">
                {crops
                  .slice(0, 3)
                  .map(crop => (
                    <CropRow
                      key={crop.cropId}
                      crop={crop}
                    />
                  ))
                }
              </div>
            )
          }

        </section>

        <section className="panel language-panel">

          <Globe2/>

          <span className="eyebrow">
            {t.language}
          </span>

          <h2>
            {t.languageSub}
          </h2>

          <div className="language-options">

            {[
              "en",
              "te",
              "hi"
            ].map(language => (
              <button
                key={language}
                className={
                  lang === language
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  localStorage.setItem(
                    "sp_lang",
                    language
                  );

                  location.reload();
                }}
              >
                {translations[language].name}

                {lang === language && (
                  <Check size={15}/>
                )}
              </button>
            ))}

          </div>

        </section>

      </div>

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

function Empty() {
  const {
    lang
  } = useAuth();

  const t =
    useT(lang);

  return (
    <div className="empty">

      <div>
        <Leaf/>
      </div>

      <h3>
        {t.empty}
      </h3>

      <p>
        Use the guided five-step wizard to add your first crop.
      </p>

      <Link
        className="btn primary"
        to="/farmer/crops/new"
      >
        {t.start}
        <ArrowRight size={15}/>
      </Link>

    </div>
  );
}


/*
|--------------------------------------------------------------------------
| CROP ROW
|--------------------------------------------------------------------------
*/

function CropRow({
  crop
}) {
  const {
    lang
  } = useAuth();

  const t =
    useT(lang);

  return (
    <Link
      className="crop-row"
      to={`/farmer/crops/${crop.cropId}`}
    >

      <div className="crop-icon">
        <Leaf/>
      </div>

      <div>
        <b>
          {crop.cropName}
        </b>

        <span>
          {crop.cropVariety}
          {" • "}
          {crop.quantityKg}
          {" kg"}
        </span>
      </div>

      <div className="crop-date">

        <small>
          {t.expected}
        </small>

        <b>
          {fmtDate(
            crop.expectedProcurementDate
          )}
        </b>

      </div>

      <ChevronRight/>

    </Link>
  );
}

function fmtDate(value) {
  return new Date(
    value + "T00:00:00"
  ).toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


/*
|--------------------------------------------------------------------------
| CROP REGISTRATION WIZARD
|--------------------------------------------------------------------------
*/

const cropOptions = [
  "Paddy", "Wheat", "Maize", "Cotton", "Groundnut",
  "Chilli", "Turmeric", "Red Gram", "Green Gram"
];

function Wizard() {
  const {
    farmer,
    lang
  } = useAuth();

  const t =
    useT(lang);

  const nav =
    useNavigate();

  const [
    step,
    setStep
  ] = useState(1);

  const [
    saved,
    setSaved
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const [
    form,
    setForm
  ] = useState({
    cropName: "",
    cropVariety: "",
    quantityKg: "",
    location:
      farmer.location ||
      farmer.village ||
      "",
    harvestDate: "",
    expectedProcurementDate: ""
  });

  const [centres, setCentres] = useState([]);
  const [centreLoading, setCentreLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(null);
  const [availableCropTypes, setAvailableCropTypes] = useState([]);

  useEffect(() => {
    api("/farmer/crop-types")
      .then(data => setAvailableCropTypes(data.cropTypes || []))
      .catch(() => setAvailableCropTypes([]));
  }, []);

  const stepLabels = [
    t.step1,
    t.step2,
    t.step3,
    t.step4,
    t.step5
  ];

  function update(
    key,
    value
  ) {
    setForm(
      current => ({
        ...current,
        [key]: value
      })
    );

    setError("");
  }

  async function findNearbyCentres() {
    if (!form.location.trim()) {
      setError("Enter your village name first.");
      return;
    }

    setCentreLoading(true);
    setError("");
    setSelectedCentre(null);
    setSlots([]);
    setSelectedSlot(null);

    try {
      const data = await api(`/farmer/centres?village=${encodeURIComponent(form.location.trim())}`);
      const list = data.centres || [];
      setCentres(list);
      if (!list.length) setError("No active procurement centre is available for this village yet. Please try the district/location name or ask the admin to add a centre.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCentreLoading(false);
    }
  }

  async function loadSlots(centre, date) {
    if (!centre || !date) return;
    setSlotLoading(true);
    setError("");
    setSelectedSlot(null);
    try {
      const data = await api(`/farmer/bookings/slots/${centre.id}?date=${encodeURIComponent(date)}`);
      setSlots(data.slots || []);
      if (!(data.slots || []).length) setError("No time slots are available for this centre on the selected date.");
    } catch (err) {
      setSlots([]);
      setError(err.message);
    } finally {
      setSlotLoading(false);
    }
  }

  useEffect(() => {
    if (step === 4 && selectedCentre && form.expectedProcurementDate) {
      loadSlots(selectedCentre, form.expectedProcurementDate);
    }
  }, [step, selectedCentre?.id, form.expectedProcurementDate]);

  function next() {
    if (step === 1 && !form.cropName) return setError("Please select a crop.");
    if (step === 2 && (!form.quantityKg || Number(form.quantityKg) <= 0)) return setError("Enter a valid quantity.");

    if (step === 3) {
      if (!form.location.trim()) return setError("Enter your village or crop location.");
      if (!selectedCentre) return setError("Select a nearby procurement centre before continuing.");
    }

    if (step === 4) {
      if (!form.harvestDate || !form.expectedProcurementDate) return setError("Please select both dates.");
      if (form.expectedProcurementDate < form.harvestDate) return setError("Expected procurement date cannot be before harvest date.");
      if (!selectedSlot) return setError("Select an available time slot.");
    }

    setError("");
    setStep(current => Math.min(5, current + 1));
  }

  async function submit() {
    setError("");
    if (!selectedCentre || !selectedSlot) {
      setError("Please select a procurement centre and time slot.");
      return;
    }

    try {
      const cropResponse = await api("/farmer/crops", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantityKg: Number(form.quantityKg)
        })
      });

      const cropId = cropResponse.crop?.cropId;
      if (!cropId) throw new Error("Crop was saved but its ID could not be created.");

      const bookingResponse = await api("/farmer/bookings", {
        method: "POST",
        body: JSON.stringify({
          cropId: Number(cropId),
          centreId: Number(selectedCentre.id),
          slotId: Number(selectedSlot.slot_id),
          bookingSource: "FARMER"
        })
      });

      setBooking(bookingResponse.booking);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (saved) {
    return (
      <Layout>

        <div className="success-screen">

          <div className="success-icon">
            <Check/>
          </div>

          <span className="eyebrow">
            REGISTRATION COMPLETE
          </span>

          <h1>
            {t.success}
          </h1>

          <p>
            Your crop is saved under your Farmer ID
            {" "}
            <b>
              #{farmer.farmerId}
            </b>.
          </p>

          <div className="success-card">
            <div><Leaf/><span>{form.cropName}</span><b>{form.quantityKg} kg</b></div>
            <div><MapPin/><span>{selectedCentre?.name || form.location}</span><b>{selectedCentre?.code || ""}</b></div>
            <div><Clock3/><span>{selectedSlot ? `${selectedSlot.start_time} – ${selectedSlot.end_time}` : ""}</span><b>{fmtDate(form.expectedProcurementDate)}</b></div>
          </div>

          {booking && (
            <div className="booking-token-card">
              <span className="eyebrow">YOUR UNIQUE PROCUREMENT TOKEN</span>
              <strong>{booking.token_number}</strong>
              <p>Show this token at <b>{booking.centre_name}</b> when you arrive.</p>
            </div>
          )}

          <div className="actions">

            <Link
              className="btn primary"
              to="/farmer/queue"
            >
              <Timer size={15}/>
              {t.bookedGoQueue}
            </Link>

            <Link
              className="btn ghost"
              to="/farmer/crops"
            >
              {t.crops}
            </Link>

            <Link
              className="btn ghost"
              to="/farmer/recommendations"
            >
              <Sparkles size={15}/>
              {t.aiRecommendations}
            </Link>

            <Link
              className="btn ghost"
              to="/farmer/crops/new"
            >
              Register Another
            </Link>

          </div>

        </div>

      </Layout>
    );
  }

  return (
    <Layout>

      <div className="wizard-head">

        <Link to="/farmer/dashboard">
          <ArrowLeft size={15}/>
          {t.dashboard}
        </Link>

        <span className="eyebrow">
          {t.register}
        </span>

        <h1>
          Tell us about your crop.
        </h1>

        <p>
          A short guided flow. One decision at a time.
        </p>

      </div>

      <div className="wizard">

        <div className="wizard-progress">

          {stepLabels.map(
            (label, index) => (
              <React.Fragment
                key={label}
              >

                <div
                  className={
                    index + 1 <= step
                      ? "done"
                      : ""
                  }
                >

                  <span>
                    {index + 1 < step
                      ? <Check size={13}/>
                      : index + 1
                    }
                  </span>

                  <b>
                    {label}
                  </b>

                </div>

                {index < 4 && (
                  <i/>
                )}

              </React.Fragment>
            )
          )}

        </div>

        <div className="wizard-body">

          <div className="step-copy">

            <span>
              STEP {step} OF 5
            </span>

            <h2>
              {
                [
                  t.choose,
                  t.enterQty,
                  t.chooseLocation,
                  t.chooseDate,
                  t.review
                ][step - 1]
              }
            </h2>

          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="crop-options">

              {(availableCropTypes.length ? availableCropTypes.map(x => x.name) : cropOptions).map(
                cropName => (
                  <button
                    key={cropName}
                    className={
                      form.cropName ===
                      cropName
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      update(
                        "cropName",
                        cropName
                      )
                    }
                  >

                    <Leaf size={17}/>

                    <span>
                      {cropName}
                    </span>

                    {form.cropName ===
                      cropName && (
                        <CheckCircle2/>
                    )}

                  </button>
                )
              )}

            </div>
          )}

          {step === 2 && (
            <div className="big-input">

              <label>
                {t.quantity}

                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="0.1"
                  value={form.quantityKg}
                  onChange={e =>
                    update(
                      "quantityKg",
                      e.target.value
                    )
                  }
                  placeholder="e.g. 850"
                />

                <span>
                  kg
                </span>

              </label>

              <div className="hint">
                Example: Paddy • 850 kg
              </div>

              <label>
                {t.variety}

                <input
                  value={
                    form.cropVariety
                  }
                  onChange={e =>
                    update(
                      "cropVariety",
                      e.target.value
                    )
                  }
                  placeholder="e.g. BPT 5204"
                />

              </label>

            </div>
          )}

          {step === 3 && (
            <div className="location-step">
              <div className="location-banner">
                <MapPin/>
                <div>
                  <b>Find a nearby procurement centre</b>
                  <p>Enter your village. We rank active centres by village/location match and current queue load.</p>
                </div>
              </div>

              <label>
                Village / crop location
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    style={{ flex: 1 }}
                    value={form.location}
                    onChange={e => update("location", e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); findNearbyCentres(); } }}
                    placeholder="e.g. Shamshabad"
                  />
                  <button type="button" className="btn primary" onClick={findNearbyCentres} disabled={centreLoading}>
                    {centreLoading ? "Finding…" : "Find Centres"}
                  </button>
                </div>
              </label>

              <div className="location-grid">
                <label>{t.district}<input value={farmer.district || ""} readOnly placeholder="From your profile"/></label>
                <label>{t.village}<input value={farmer.village || ""} readOnly placeholder="From your profile"/></label>
              </div>

              {centres.length > 0 && (
                <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                  <div className="eyebrow">NEARBY ACTIVE CENTRES</div>
                  {centres.map(centre => (
                    <button
                      type="button"
                      key={centre.id}
                      onClick={() => { setSelectedCentre(centre); setSlots([]); setSelectedSlot(null); setError(""); }}
                      className={selectedCentre?.id === centre.id ? "centre-choice selected" : "centre-choice"}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                        <div style={{ textAlign: "left" }}>
                          <strong>{centre.name}</strong>
                          <span>{centre.code} · {centre.location}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong>{centre.queue_count ?? 0} farmers</strong>
                          <span>ahead/in queue · {centre.proximity_label}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="date-grid">
              <label>
                <CalendarDays/>
                {t.harvest}
                <input type="date" value={form.harvestDate} onChange={e => update("harvestDate", e.target.value)}/>
              </label>

              <label>
                <Clock3/>
                {t.expected}
                <input
                  type="date"
                  value={form.expectedProcurementDate}
                  min={form.harvestDate || undefined}
                  onChange={e => update("expectedProcurementDate", e.target.value)}
                />
              </label>

              {selectedCentre && (
                <div style={{ gridColumn: "1 / -1", marginTop: "10px" }}>
                  <div className="location-banner">
                    <Warehouse/>
                    <div><b>{selectedCentre.name}</b><p>{selectedCentre.queue_count ?? 0} farmers currently registered in the queue for this centre.</p></div>
                  </div>

                  <div style={{ marginTop: "18px" }}>
                    <div className="eyebrow">AVAILABLE TIME SLOTS</div>
                    {slotLoading ? (
                      <div className="loading">Loading time slots…</div>
                    ) : slots.length ? (
                      <div className="slot-choice-grid">
                        {slots.map(slot => {
                          const remaining = Number(slot.capacity) - Number(slot.booked_count);
                          return (
                            <button type="button" key={slot.slot_id} onClick={() => { setSelectedSlot(slot); setError(""); }} className={selectedSlot?.slot_id === slot.slot_id ? "slot-choice selected" : "slot-choice"}>
                              <strong>{slot.start_time} – {slot.end_time}</strong>
                              <span>{remaining} seats available</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty" style={{ padding: "28px" }}>
                        {form.expectedProcurementDate
                          ? "No time slots are available for this date. Please choose another procurement date."
                          : "Select a procurement date to see available time slots."}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="review">

              <div className="review-hero">

                <Leaf/>

                <div>

                  <span>
                    {t.crop}
                  </span>

                  <h3>
                    {form.cropName}
                  </h3>

                  <b>
                    {form.cropVariety ||
                      "Variety not entered"
                    }
                  </b>

                </div>

              </div>

              {[
                [t.quantity, `${form.quantityKg} kg`],
                [t.location, form.location],
                [t.harvest, fmtDate(form.harvestDate)],
                [t.expected, fmtDate(form.expectedProcurementDate)],
                [t.centre, selectedCentre ? `${selectedCentre.name} (${selectedCentre.code})` : "—"],
                [t.slot, selectedSlot ? `${selectedSlot.start_time} – ${selectedSlot.end_time}` : "—"],
                [t.phone, farmer.mobile]
              ].map(
                ([label, value]) => (
                  <div
                    className="review-row"
                    key={label}
                  >
                    <span>
                      {label}
                    </span>

                    <b>
                      {value}
                    </b>
                  </div>
                )
              )}

            </div>
          )}

          <div className="wizard-actions">

            {step > 1
              ? (
                <button
                  className="btn ghost"
                  onClick={() =>
                    setStep(
                      step - 1
                    )
                  }
                >
                  <ArrowLeft size={15}/>
                  {t.back}
                </button>
              )
              : <span/>
            }

            {step < 5
              ? (
                <button
                  className="btn primary"
                  onClick={next}
                >
                  {t.next}
                  <ArrowRight size={15}/>
                </button>
              )
              : (
                <button
                  className="btn primary"
                  onClick={submit}
                >
                  {t.confirm}
                  <Check size={15}/>
                </button>
              )
            }

          </div>

        </div>

      </div>

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| CROPS
|--------------------------------------------------------------------------
*/

function Crops() {
  const {
    lang
  } = useAuth();

  const t =
    useT(lang);

  const [
    data,
    setData
  ] = useState(null);

  useEffect(() => {

    api("/farmer/crops")
      .then(setData)
      .catch(() =>
        setData({
          crops: []
        })
      );

  }, []);

  return (
    <Layout>

      <div className="page-head">

        <div>

          <span className="eyebrow">
            {t.crops}
          </span>

          <h1>
            Your crop records.
          </h1>

          <p>
            Every registration is tied to your Farmer ID and ready for future procurement services.
          </p>

        </div>

        <div
          style={{
            display: "flex",
            gap: "8px"
          }}
        >

          <Link
            className="btn ghost"
            to="/farmer/recommendations"
          >
            <Sparkles size={15}/>
            {t.aiRecommendations}
          </Link>

          <Link
            className="btn primary"
            to="/farmer/crops/new"
          >
            {t.register}
            <ArrowRight size={15}/>
          </Link>

        </div>

      </div>

      {!data
        ? (
          <div className="loading">
            Loading…
          </div>
        )
        : data.crops.length === 0
          ? <Empty/>
          : (
            <div className="records">

              {data.crops.map(
                crop => (
                  <div
                    className="record"
                    key={crop.cropId}
                  >

                    <CropRow
                      crop={crop}
                    />

                    <div className="record-meta">

                      <span>
                        Farmer ID
                        {" "}
                        <b>
                          #{crop.farmerId}
                        </b>
                      </span>

                      <span>
                        Harvest
                        {" "}
                        <b>
                          {fmtDate(
                            crop.harvestDate
                          )}
                        </b>
                      </span>

                      <span>
                        Location
                        {" "}
                        <b>
                          {crop.location}
                        </b>
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>
          )
      }

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| CROP DETAIL
|--------------------------------------------------------------------------
*/

function CropDetail({
  id
}) {
  const {
    lang
  } = useAuth();

  const t =
    useT(lang);

  const [
    crop,
    setCrop
  ] = useState(null);

  useEffect(() => {
    api(
      "/farmer/crops/" + id
    )
      .then(data =>
        setCrop(data.crop)
      )
      .catch(() => {});
  }, [id]);

  if (!crop) {
    return (
      <Layout>
        <div className="loading">
          Loading…
        </div>
      </Layout>
    );
  }

  return (
    <Layout>

      <Link
        className="back-link"
        to="/farmer/crops"
      >
        <ArrowLeft size={15}/>
        {t.crops}
      </Link>

      <div className="detail">

        <div className="detail-hero">

          <div className="crop-icon large">
            <Leaf/>
          </div>

          <span className="eyebrow">
            {t.details}
          </span>

          <h1>
            {crop.cropName}
          </h1>

          <p>
            {crop.cropVariety}
          </p>

        </div>

        <div className="detail-grid">

          {[
            [
              t.quantity,
              `${crop.quantityKg} kg`
            ],
            [
              t.harvest,
              fmtDate(
                crop.harvestDate
              )
            ],
            [
              t.expected,
              fmtDate(
                crop.expectedProcurementDate
              )
            ],
            [
              t.location,
              crop.location
            ],
            [
              "Farmer ID",
              `#${crop.farmerId}`
            ]
          ].map(
            ([label, value]) => (
              <div key={label}>
                <span>
                  {label}
                </span>
                <b>
                  {value}
                </b>
              </div>
            )
          )}

        </div>

      </div>

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

function Profile() {
  const {
    farmer,
    setFarmer,
    lang,
    setLang
  } = useAuth();

  const t =
    useT(lang);

  const [
    form,
    setForm
  ] = useState({
    ...farmer
  });

  const [
    msg,
    setMsg
  ] = useState("");

  const [
    busy,
    setBusy
  ] = useState(false);

  async function save(e) {
    e.preventDefault();

    setBusy(true);

    try {

      const data =
        await api(
          "/farmer/profile",
          {
            method: "PUT",
            body: JSON.stringify(form)
          }
        );

      setFarmer(
        data.farmer
      );

      setLang(
        data.farmer.preferredLanguage
      );

      setMsg(
        "Profile updated successfully."
      );

    } catch (err) {

      setMsg(
        err.message
      );

    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>

      <div className="page-head">

        <div>

          <span className="eyebrow">
            {t.profile}
          </span>

          <h1>
            {t.profileTitle}
          </h1>

          <p>
            {t.profileSub}
          </p>

        </div>

        <div className="farmer-id">
          FARMER ID
          {" "}
          <b>
            #{farmer.farmerId}
          </b>
        </div>

      </div>

      <div className="profile-grid">

        <form
          className="panel profile-form"
          onSubmit={save}
        >

          {msg && (
            <div className="success">
              {msg}
            </div>
          )}

          <div className="avatar">
            <UserRound/>
          </div>

          <div className="form-grid">

            <label>
              Name
              <input
                value={form.name}
                onChange={e =>
                  setForm({
                    ...form,
                    name:
                      e.target.value
                  })
                }
              />
            </label>

            <label>
              {t.phone}
              <input
                value={form.mobile}
                onChange={e =>
                  setForm({
                    ...form,
                    mobile:
                      e.target.value
                  })
                }
              />
            </label>

            <label>
              {t.location}
              <input
                value={
                  form.location
                }
                onChange={e =>
                  setForm({
                    ...form,
                    location:
                      e.target.value
                  })
                }
              />
            </label>

            <label>
              {t.district}
              <input
                value={
                  form.district
                }
                onChange={e =>
                  setForm({
                    ...form,
                    district:
                      e.target.value
                  })
                }
              />
            </label>

            <label>
              {t.village}
              <input
                value={
                  form.village
                }
                onChange={e =>
                  setForm({
                    ...form,
                    village:
                      e.target.value
                  })
                }
              />
            </label>

          </div>

          <button
            className="btn primary"
            disabled={busy}
          >
            <Save size={15}/>

            {busy
              ? "Saving…"
              : t.save
            }

          </button>

        </form>

        <section className="panel language-card">

          <Globe2/>

          <span className="eyebrow">
            {t.language}
          </span>

          <h2>
            {t.languageSub}
          </h2>

          <div className="language-options large">

            {[
              "en",
              "te",
              "hi"
            ].map(language => (
              <button
                key={language}
                className={
                  lang === language
                    ? "selected"
                    : ""
                }
                onClick={() => {

                  setLang(
                    language
                  );

                  setForm({
                    ...form,
                    preferredLanguage:
                      language
                  });

                }}
              >

                <b>
                  {translations[language].name}
                </b>

                <small>
                  {language === "en"
                    ? "Farmer portal in English"
                    : language === "te"
                      ? "రైతు పోర్టల్ తెలుగులో"
                      : "किसान पोर्टल हिन्दी में"
                  }
                </small>

                {lang === language && (
                  <CheckCircle2/>
                )}

              </button>
            ))}

          </div>

        </section>

      </div>

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| FARMER LIVE QUEUE
|--------------------------------------------------------------------------
*/

function queueItemValue(item, keys, fallback = "") {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return item[key];
    }
  }
  return fallback;
}

function normalizeQueueItem(item) {
  return {
    id: queueItemValue(item, ["id", "queue_id", "queueId"]),
    token: queueItemValue(item, ["token_number", "tokenNumber", "token"], "—"),
    position: Number(queueItemValue(item, ["position", "queue_position", "queuePosition"], 0)),
    wait: Number(queueItemValue(item, ["calculated_wait_minutes", "calculatedWaitMinutes", "estimated_wait_minutes", "estimatedWaitMinutes", "estimated_wait", "estimatedWait"], 0)),
    ahead: Number(queueItemValue(item, ["people_ahead", "peopleAhead"], 0)),
    status: String(queueItemValue(item, ["status"], "WAITING")).toUpperCase(),
    centre: queueItemValue(item, ["centre_name", "centre", "centreName"], "Procurement Centre"),
    centreCode: queueItemValue(item, ["centre_code", "centreCode"], ""),
    crop: queueItemValue(item, ["crop_name", "crop", "cropName"], ""),
    variety: queueItemValue(item, ["crop_variety", "variety", "cropVariety"], ""),
    queueDate: queueItemValue(item, ["queue_date", "queueDate"], ""),
    raw: item
  };
}

function queueStatusLabel(status) {
  return String(status || "—").replaceAll("_", " ");
}

function queueStatusClass(status) {
  return `queue-status queue-status-${String(status || "").toLowerCase()}`;
}

function Queue() {
  const {
    lang
  } = useAuth();

  const t = useT(lang);

  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api("/farmer/queue/live");
      const items = Array.isArray(response.queue)
        ? response.queue
        : Array.isArray(response.queues)
          ? response.queues
          : response.queue
            ? [response.queue]
            : [];

      setData(items.map(normalizeQueueItem));
      setSummary(response.summary || response);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(() => {
      load(true);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const active = data.filter(item =>
    !["COMPLETED", "REJECTED", "RETURNED"].includes(item.status)
  );

  const mine = active[0] || data[0] || null;

  const explicitNowServing = Number(
    summary.nowServing ??
    summary.now_serving ??
    summary.currentToken ??
    summary.current_token ??
    0
  );

  const called = data.find(item => item.status === "CALLED");
  const processing = data.find(item => item.status === "PROCESSING");
  const nowServing = explicitNowServing ||
    Number((called || processing)?.token || 0) ||
    0;

  return (
    <Layout>

      <div className="page-head">
        <div>
          <span className="eyebrow">
            FARMER PORTAL
          </span>

          <h1>
            {t.liveQueue}
          </h1>

          <p>
            Track your token, current position and estimated waiting time.
          </p>
        </div>

        <button
          className="btn ghost"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : t.viewQueue}
        </button>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          Loading live queue…
        </div>
      ) : (
        <>
          <div
            className="dashboard-grid"
            style={{ marginBottom: "20px" }}
          >
            <section
              className="panel"
              style={{ background: "linear-gradient(145deg,#15251d,#214232)", color: "#fff" }}
            >
              <span className="eyebrow">
                {t.nowServing}
              </span>

              <div style={{ marginTop: "10px" }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "42px",
                    lineHeight: 1
                  }}
                >
                  {nowServing || "—"}
                </strong>
              </div>

              <p style={{ opacity: 0.8 }}>
                {t.activeQueue}: {active.length}
              </p>
            </section>

            <section className="panel">
              <span className="eyebrow">
                {t.refreshQueue}
              </span>

              <h2 style={{ marginTop: "10px" }}>
                {mine ? queueStatusLabel(mine.status) : t.noQueue}
              </h2>

              {lastUpdated && (
                <p>
                  Last updated {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </section>
          </div>

          {mine ? (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">
                    YOUR TOKEN
                  </span>

                  <h2>
                    #{mine.token}
                  </h2>
                </div>

                <span className={queueStatusClass(mine.status)}>
                  {queueStatusLabel(mine.status)}
                </span>
              </div>

              <div
                className="dashboard-grid"
                style={{ marginTop: "18px" }}
              >
                <div className="settings-card">
                  <Clock3/>
                  <div>
                    <b>{t.yourPosition}</b>
                    <span>
                      {mine.position > 0
                        ? `#${mine.position}`
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <UserRound/>
                  <div>
                    <b>Farmers Ahead</b>
                    <span>{mine.ahead}</span>
                  </div>
                </div>

                <div className="settings-card">
                  <Timer/>
                  <div>
                    <b>{t.estimatedWait}</b>
                    <span>
                      {Number.isFinite(mine.wait)
                        ? `${Math.max(0, mine.wait).toFixed(0)} minutes`
                        : "Calculating…"}
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <Warehouse/>
                  <div>
                    <b>{t.centre}</b>
                    <span>
                      {mine.centre}
                      {mine.centreCode ? ` · ${mine.centreCode}` : ""}
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <Leaf/>
                  <div>
                    <b>{t.crop}</b>
                    <span>
                      {mine.crop || "—"}
                      {mine.variety ? ` · ${mine.variety}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  padding: "18px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.04)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px"
                  }}
                >
                  <b>{t.queueStatus}</b>
                  <strong>{queueStatusLabel(mine.status)}</strong>
                </div>

                <div
                  style={{
                    marginTop: "12px",
                    height: "10px",
                    background: "rgba(0,0,0,0.08)",
                    borderRadius: "999px",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: mine.position > 0
                        ? `${Math.max(10, Math.min(100, 100 - Math.min(mine.position * 5, 90)))}%`
                        : "100%",
                      height: "100%",
                      borderRadius: "999px",
                      background: "currentColor"
                    }}
                  />
                </div>
              </div>
            </section>
          ) : (
            <div className="empty">
              <div>
                <Clock3/>
              </div>
              <h3>{t.noQueue}</h3>
              <p>
                Book an available procurement slot to receive a token and join the queue.
              </p>
              <Link
                className="btn primary"
                to="/farmer/recommendations"
              >
                <Sparkles size={15}/>
                {t.aiRecommendations}
              </Link>
            </div>
          )}

          {data.length > 0 && (
            <section className="panel" style={{ marginTop: "20px" }}>
              <div className="panel-title">
                <div>
                  <span className="eyebrow">
                    {t.activeQueue}
                  </span>
                  <h2>Queue overview</h2>
                </div>
                <span>{data.length} record{data.length === 1 ? "" : "s"}</span>
              </div>

              <div className="records">
                {data.map(item => (
                  <div className="record" key={item.id || `${item.token}-${item.status}`}>
                    <div className="crop-row" style={{ cursor: "default" }}>
                      <div className="crop-icon">
                        <Clock3/>
                      </div>
                      <div>
                        <b>Token #{item.token}</b>
                        <span>
                          {item.centre}
                          {item.centreCode ? ` · ${item.centreCode}` : ""}
                        </span>
                      </div>
                      <div className="crop-date">
                        <small>{t.estimatedWait}</small>
                        <b>{item.wait > 0 ? `${item.wait.toFixed(0)} min` : "—"}</b>
                      </div>
                      <span className={queueStatusClass(item.status)}>
                        {queueStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="record-meta">
                      <span>{t.yourPosition} <b>{item.position || "—"}</b></span>
                      <span>{t.crop} <b>{item.crop || "—"}</b></span>
                      <span>{t.bookingDate} <b>{item.queueDate || "—"}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| AI RECOMMENDATION PAGE
|--------------------------------------------------------------------------
*/

function Recommendations() {
  const {
    farmer,
    lang
  } = useAuth();

  const t =
    useT(lang);

  const [
    crops,
    setCrops
  ] = useState([]);

  const [
    cropId,
    setCropId
  ] = useState("");

  const [
    predictionDate,
    setPredictionDate
  ] = useState(
    new Date()
      .toISOString()
      .slice(0, 10)
  );

  const [
    recommendations,
    setRecommendations
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const [
    bookingId,
    setBookingId
  ] = useState(null);

  const [
    booking,
    setBooking
  ] = useState(null);

  const [
    bookingBusy,
    setBookingBusy
  ] = useState(false);

  useEffect(() => {

    api("/farmer/crops")
      .then(data => {

        const farmerCrops =
          data.crops || [];

        setCrops(
          farmerCrops
        );

        if (
          farmerCrops.length > 0
        ) {
          setCropId(
            String(
              farmerCrops[0].cropId
            )
          );
        }

      })
      .catch(err =>
        setError(err.message)
      );

  }, []);

  async function loadRecommendations() {

    if (!cropId) {
      setError(
        "Please select a crop."
      );
      return;
    }

    if (!predictionDate) {
      setError(
        "Please select a procurement date."
      );
      return;
    }

    setLoading(true);
    setError("");
    setRecommendations([]);
    setBooking(null);
    setBookingId(null);

    try {

      const data =
        await api(
          `/farmer/ai/recommendations?cropId=${encodeURIComponent(cropId)}&predictionDate=${encodeURIComponent(predictionDate)}`
        );

      setRecommendations(
        data.recommendations ||
        []
      );

    } catch (err) {

      setError(
        err.message
      );

    } finally {
      setLoading(false);
    }
  }

  async function bookRecommendation(
    recommendation
  ) {
    setBookingBusy(true);
    setError("");
    setBooking(null);

    try {

      const outputData =
        parseRecommendationOutput(
          recommendation.output_data
        );

      const data =
        await api(
          "/farmer/bookings",
          {
            method: "POST",
            body: JSON.stringify({
              cropId:
                Number(cropId),

              centreId:
                Number(
                  recommendation.centre_id
                ),

              slotId:
                Number(
                  recommendation.slot_id
                ),

              bookingSource:
                "AI_RECOMMENDED",

              recommendationScore:
                Number(
                  recommendation.recommendation_score
                )
            })
          }
        );

      setBooking(
        data.booking
      );

      setBookingId(
        data.booking?.booking_id ||
        null
      );

    } catch (err) {

      /*
      The recommendation output is not required
      by the booking API. Keep this reference here
      so the frontend remains compatible if it is
      later extended.
      */

      setError(
        err.message
      );

    } finally {
      setBookingBusy(false);
    }
  }

  return (
    <Layout>

      <div className="recommendation-page">

        <div className="page-head">

          <div>

            <span className="eyebrow">
              FARMER PORTAL
            </span>

            <h1>
              {t.aiRecommendations}
            </h1>

            <p>
              {t.aiSub}
            </p>

          </div>

          <LanguageSwitcher/>

        </div>

        <div className="recommendation-hero">

          <div>

            <span className="eyebrow">
              {t.aiPowered}
            </span>

            <h1>
              Smarter procurement decisions.
            </h1>

            <p>
              AI compares queue wait time, available capacity, procurement price and price trend to rank the best available centre and slot for your crop.
            </p>

          </div>

          <div className="recommendation-hero-icon">
            <Sparkles size={42}/>
          </div>

        </div>

        {booking && (
          <div className="booking-success-card">

            <span className="eyebrow">
              BOOKING CONFIRMED
            </span>

            <h2>
              {t.bookingSuccess}
            </h2>

            <p>
              Your recommended procurement slot has been reserved.
            </p>

            <div className="booking-token">

              <span>
                {t.token}
              </span>

              <b>
                {booking.token_number}
              </b>

            </div>

          </div>
        )}

        <div className="recommendation-controls">

          <h2>
            Find your best centre and slot
          </h2>

          <div className="recommendation-control-grid">

            <label>
              {t.selectCrop}

              <select
                value={cropId}
                onChange={e =>
                  setCropId(
                    e.target.value
                  )
                }
              >

                <option value="">
                  {t.selectCrop}
                </option>

                {crops.map(
                  crop => (
                    <option
                      key={crop.cropId}
                      value={crop.cropId}
                    >
                      {crop.cropName}
                      {" — "}
                      {crop.cropVariety}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              {t.selectDate}

              <input
                type="date"
                value={predictionDate}
                onChange={e =>
                  setPredictionDate(
                    e.target.value
                  )
                }
              />

            </label>

          </div>

          <button
            className="btn primary"
            onClick={
              loadRecommendations
            }
            disabled={
              loading ||
              !cropId
            }
            style={{
              marginTop: "14px"
            }}
          >

            <Sparkles size={15}/>

            {loading
              ? "Analyzing..."
              : t.getRecommendations
            }

          </button>

        </div>

        {error && (
          <div className="recommendation-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="recommendation-loading">
            <div>
              Analyzing demand, queue and price data…
            </div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="recommendation-empty">

            <div className="recommendation-empty-icon">
              <Sparkles/>
            </div>

            <h3>
              {cropId
                ? t.noRecommendation
                : t.selectCrop
              }
            </h3>

            <p>
              {cropId
                ? t.noRecommendationText
                : "Select one of your registered crops to generate AI recommendations."
              }
            </p>

          </div>
        ) : (
          <div className="recommendation-list">

            {recommendations.map(
              recommendation => {

                const output =
                  parseRecommendationOutput(
                    recommendation.output_data
                  );

                const rank =
                  Number(
                    recommendation.recommendation_rank
                  );

                const isBest =
                  rank === 1;

                const trend =
                  String(
                    output.priceTrend ||
                    "UNKNOWN"
                  ).toUpperCase();

                return (
                  <div
                    className={
                      "recommendation-card" +
                      (
                        isBest
                          ? " best"
                          : ""
                      )
                    }
                    key={
                      recommendation.prediction_id
                    }
                  >

                    <div className="recommendation-top">

                      <div className="recommendation-rank">

                        <div className="recommendation-rank-number">
                          #{rank}
                        </div>

                        <div className="recommendation-rank-text">

                          <small>
                            {isBest
                              ? t.bestRecommendation
                              : "AI RECOMMENDATION"
                            }
                          </small>

                          <b>
                            {output.centreName ||
                              "Procurement Centre"
                            }
                          </b>

                        </div>

                      </div>

                      <div className="recommendation-score">

                        <small>
                          {t.recommendationScore}
                        </small>

                        <strong>
                          {(
                            Number(
                              recommendation.recommendation_score
                            ) * 100
                          ).toFixed(0)}
                          %
                        </strong>

                      </div>

                    </div>

                    <div className="recommendation-main">

                      <div className="recommendation-location">

                        <div className="location-title">

                          <Warehouse/>

                          <div>

                            <h3>
                              {output.centreName}
                            </h3>

                            <p>
                              {output.centreCode}
                            </p>

                          </div>

                        </div>

                        <div className="recommendation-slot">

                          <Clock3/>

                          <span>
                            {output.startTime}
                            {" – "}
                            {output.endTime}
                          </span>

                        </div>

                      </div>

                      <div className="recommendation-stats">

                        <div className="recommendation-stat">

                          <span>
                            {t.predictedWait}
                          </span>

                          <b>
                            {Number(
                              output.predictedWait ||
                              recommendation.predicted_value ||
                              0
                            ).toFixed(1)}
                            {" min"}
                          </b>

                        </div>

                        <div className="recommendation-stat">
                          <span>Farmers in Queue</span>
                          <b>{output.queueLength ?? 0}</b>
                        </div>

                        <div className="recommendation-stat">
                          <span>{t.capacity}</span>
                          <b>{output.availableCapacity ?? 0}</b>
                        </div>

                        <div
                          className={
                            "recommendation-stat " +
                            (
                              trend === "UP"
                                ? "trend-up"
                                : trend === "DOWN"
                                  ? "trend-down"
                                  : "trend-stable"
                            )
                          }
                        >

                          <span>
                            {t.trend}
                          </span>

                          <b>
                            {trend}
                          </b>

                        </div>

                      </div>

                    </div>

                    <div className="recommendation-footer">

                      <div className="recommendation-footer-text">

                        <b>
                          {t.centre}:
                        </b>
                        {" "}
                        {output.centreName}

                        {" • "}

                        <b>
                          {t.slot}:
                        </b>
                        {" "}
                        {output.startTime}
                        {"–"}
                        {output.endTime}

                      </div>

                      <button
                        className="btn primary"
                        onClick={() =>
                          bookRecommendation(
                            recommendation
                          )
                        }
                        disabled={
                          bookingBusy
                        }
                      >

                        <CheckCircle2 size={15}/>

                        {bookingBusy
                          ? t.booking
                          : t.book
                        }

                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </div>

    </Layout>
  );
}


/*
|--------------------------------------------------------------------------
| RECOMMENDATION OUTPUT PARSER
|--------------------------------------------------------------------------
*/

function parseRecommendationOutput(
  value
) {
  if (!value) {
    return {};
  }

  if (
    typeof value ===
    "object"
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}


/*
|--------------------------------------------------------------------------
| APPLICATION ROUTES
|--------------------------------------------------------------------------
*/

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="/login"
        element={<Login/>}
      />

      <Route
        path="/signup"
        element={<Signup/>}
      />

      <Route
        path="/forgot-password"
        element={<Navigate to="/login" replace/>}
      />

      <Route
        path="/select-role"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="/admin/login"
        element={<AdminLogin/>}
      />

      <Route
        path="/admin"
        element={<AdminDashboard/>}
      />

      <Route
        path="/admin/procurement"
        element={<Procurement/>}
      />

      <Route
        path="/admin/farmers"
        element={<AdminFarmers/>}
      />

      <Route
        path="/admin/centres"
        element={<Centres/>}
      />

      <Route
        path="/admin/queue"
        element={<AdminQueue/>}
      />

      <Route
        path="/admin/crop-types"
        element={<CropTypes/>}
      />

      <Route
        path="/admin/prices"
        element={<Prices/>}
      />

      <Route
        path="/admin/transactions"
        element={<Transactions/>}
      />

      <Route
        path="/admin/settings"
        element={<SettingsPage/>}
      />

      <Route
        path="/farmer/login"
        element={<Login/>}
      />

      <Route
        path="/farmer/dashboard"
        element={
          <Protected>
            <Dashboard/>
          </Protected>
        }
      />

      <Route
        path="/farmer/crops/new"
        element={
          <Protected>
            <Wizard/>
          </Protected>
        }
      />

      <Route
        path="/farmer/crops"
        element={
          <Protected>
            <Crops/>
          </Protected>
        }
      />

      <Route
        path="/farmer/crops/:id"
        element={
          <Protected>
            <CropDetailWrapper/>
          </Protected>
        }
      />

      <Route
        path="/farmer/recommendations"
        element={
          <Protected>
            <Recommendations/>
          </Protected>
        }
      />

      <Route
        path="/farmer/queue"
        element={
          <Protected>
            <Queue/>
          </Protected>
        }
      />

      <Route
        path="/farmer/profile"
        element={
          <Protected>
            <Profile/>
          </Protected>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/farmer/login"
            replace
          />
        }
      />

    </Routes>
  );
}

function CropDetailWrapper() {
  const location =
    useLocation();

  return (
    <CropDetail
      id={
        location.pathname
          .split("/")
          .pop()
      }
    />
  );
}


/*
|--------------------------------------------------------------------------
| START APPLICATION
|--------------------------------------------------------------------------
*/

createRoot(
  document.getElementById("root")
).render(
  <BrowserRouter>
    <AuthProvider>
      <App/>
    </AuthProvider>
  </BrowserRouter>
);