

import { useEffect, useState } from "react";

import AdminDashboard from "./AdminDashboard";

import "./App.css";

const API_URL = "http://localhost:8080/api";

const emptyCrop = {

name: "",

category: "Vegetables",

quantityKg: "",

pricePerKg: "",

wholesalePricePerKg: "",

discount25Kg: "",

discount50Kg: "",

discount100Kg: "",

description: "",

};

const ORDER_STEPS = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

function OrderProgress({ status }) {
  const currentStatus = String(status || "PLACED").toUpperCase();
  if (currentStatus === "CANCELLED") return <div className="order-cancelled" role="status"><strong>Order cancelled</strong><span>Contact the farmer if you need more information.</span></div>;
  const activeIndex = Math.max(0, ORDER_STEPS.indexOf(currentStatus));
  return <div className="order-progress" aria-label={`Order status: ${currentStatus}`}>
    {ORDER_STEPS.map((step, index) => <div className={`order-progress-step ${index <= activeIndex ? "is-complete" : ""} ${index === activeIndex ? "is-current" : ""}`} key={step}><span className="order-progress-dot">{index < activeIndex ? "✓" : index + 1}</span><span className="order-progress-label">{step.charAt(0) + step.slice(1).toLowerCase()}</span></div>)}
  </div>;
}

function formatOrderDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function getExpectedDelivery(value, status) {
  const normalizedStatus = String(status || "PLACED").toUpperCase();
  if (normalizedStatus === "DELIVERED") return "Delivered";
  if (normalizedStatus === "CANCELLED") return "Not applicable (order cancelled)";
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return "3–5 days from order date";
  base.setDate(base.getDate() + 4);
  return `Estimated ${base.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}


function App() {

const [showAuth, setShowAuth] = useState(false);

const [authMode, setAuthMode] = useState("login");

const [authType, setAuthType] = useState("CUSTOMER");

const [name, setName] = useState("");

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");

const [currentUser, setCurrentUser] = useState(null);

const [loading, setLoading] = useState(false);

const [crop, setCrop] = useState({ ...emptyCrop });

const [cropLoading, setCropLoading] = useState(false);

const [cropMessage, setCropMessage] = useState("");

const [myCrops, setMyCrops] = useState([]);

const [cropsLoading, setCropsLoading] = useState(false);

const [approvedCrops, setApprovedCrops] = useState([]);

const [approvedCropsLoading, setApprovedCropsLoading] = useState(false);

const [approvedCropsError, setApprovedCropsError] = useState("");

const [customerSearch, setCustomerSearch] = useState("");

const [customerCategory, setCustomerCategory] = useState("All");

  // Shopping cart state

  const [cartItems, setCartItems] = useState([]);

  const [showCart, setShowCart] = useState(false);

  const [cartMessage, setCartMessage] = useState("");
  const [cartToast, setCartToast] = useState("");
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [myOrders, setMyOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [confirmedDelivery, setConfirmedDelivery] = useState(null);
  const [orderAddresses, setOrderAddresses] = useState({});

  // When the customer opens the cart, scroll directly to the cart panel.
  useEffect(() => {
    if (showCart) {
      requestAnimationFrame(() => {
        document.getElementById("customer-shopping-cart")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [showCart]);

  const openCustomerCart = () => {
    setCartToast("");
    setShowCart(true);
  };

  const addToCart = (cropItem) => {
    const available = Number(cropItem.quantityKg || 0);
    const existing = cartItems.find((entry) => entry.id === cropItem.id);
    const currentQuantity = existing ? existing.cartQuantity : 0;

    if (currentQuantity + 1 > available) {
      setCartMessage(`Only ${available} kg of ${cropItem.name} is available.`);
      setShowCart(true);
      return;
    }

    setCartItems((previous) => {
      const found = previous.find((entry) => entry.id === cropItem.id);
      return found
        ? previous.map((entry) =>
            entry.id === cropItem.id
              ? { ...entry, cartQuantity: entry.cartQuantity + 1 }
              : entry
          )
        : [...previous, { ...cropItem, cartQuantity: 1 }];
    });
    setCartMessage("");
    setCartToast(`${cropItem.name} added to cart.`);
  };

  const removeFromCart = (cropId) => {

    setCartItems((previous) => previous.filter((entry) => entry.id !== cropId));

    setCartMessage("");

  };

  const changeCartQuantity = (cropId, delta) => {

    setCartItems((previous) => previous.map((entry) => {

      if (entry.id !== cropId) return entry;

      const next = entry.cartQuantity + delta;

      if (next <= 0) return null;

      if (next > Number(entry.quantityKg || 0)) {

        setCartMessage(`Only ${entry.quantityKg} kg of ${entry.name} is available.`);

        return entry;

      }

      return { ...entry, cartQuantity: next };

    }).filter(Boolean));

    setCartMessage("");

  };

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.cartQuantity, 0);

  const cartTotal = cartItems.reduce((sum, entry) => sum + Number(entry.pricePerKg || 0) * entry.cartQuantity, 0);

const placeCartOrders = async () => {
  if (!currentUser?.id) {
    setOrderMessage("Please log in with your customer account to place an order.");
    return;
  }
  if (cartItems.length === 0) {
    setOrderMessage("Your cart is empty. Add a crop before placing an order.");
    return;
  }
  if (!deliveryAddress.trim() || !deliveryPhone.trim()) {
    setOrderMessage("Please enter your delivery address and phone number before placing the order.");
    return;
  }
  if (!/^[6-9]\d{9}$/.test(deliveryPhone.trim())) {
    setOrderMessage("Enter a valid 10-digit Indian mobile number.");
    return;
  }

  setPlacingOrder(true);
  setOrderMessage("");
  const successfulCropIds = [];
  const newlyPlacedAddresses = {};
  const addressSnapshot = { address: deliveryAddress.trim(), phone: deliveryPhone.trim() };

  try {
    for (const item of cartItems) {
      const params = new URLSearchParams({
        customerId: String(currentUser.id),
        cropId: String(item.id),
        quantityKg: String(item.cartQuantity),
        deliveryAddress: deliveryAddress.trim(),
        deliveryPhone: deliveryPhone.trim(),
      });
      const response = await fetch(`${API_URL}/orders?${params.toString()}`, {
        method: "POST",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || `Order failed for ${item.name} (${response.status}).`);
      }
      successfulCropIds.push(item.id);
      if (result.orderId != null) newlyPlacedAddresses[result.orderId] = addressSnapshot;
    }

    setCartItems((previous) => previous.filter((item) => !successfulCropIds.includes(item.id)));
    setConfirmedDelivery(addressSnapshot);
    setOrderAddresses((previous) => ({ ...previous, ...newlyPlacedAddresses }));
    setShowCart(false);
    await loadApprovedCrops();
    await loadOrders("customer", currentUser.id);
    setOrderMessage("");
    setShowOrderSuccess(true);
    setShowOrderDetails(true);
  } catch (error) {
    setOrderMessage(error.message || "Unable to place the order. Please try again.");
  } finally {
    setPlacingOrder(false);
  }
};

const loadOrders = async (role, userId) => {
  setOrdersLoading(true);
  setOrderMessage("");
  try {
    const response = await fetch(`${API_URL}/orders/${role}/${userId}`);
    const result = await response.json().catch(() => []);
    if (!response.ok) {
      throw new Error("Unable to load orders. Check that the backend is running.");
    }
    setMyOrders(Array.isArray(result) ? result : []);
  } catch (error) {
    setOrderMessage(error.message || "Unable to load orders.");
  } finally {
    setOrdersLoading(false);
  }
};

const loadApprovedCrops = async () => {

setApprovedCropsLoading(true);

setApprovedCropsError("");

try {

const response = await fetch(`${API_URL}/crops`);

if (!response.ok) {

throw new Error(`Request failed: ${response.status}`);

}

const result = await response.json();

setApprovedCrops(Array.isArray(result) ? result : []);

} catch (error) {

console.error("Loading approved crops failed:", error);

setApprovedCropsError(

"Unable to load crops. Please check that the backend is running."

);

} finally {

setApprovedCropsLoading(false);

}

};

useEffect(() => {

loadApprovedCrops();

}, []);

const clearAuthFields = () => {

setName("");

setEmail("");

setPassword("");

};

const openCustomerLogin = () => {

clearAuthFields();

setAuthType("CUSTOMER");

setAuthMode("login");

setShowAuth(true);

};

const openFarmerLogin = () => {

clearAuthFields();

setAuthType("FARMER");

setAuthMode("login");

setShowAuth(true);

};

const openAdminLogin = () => {

clearAuthFields();

setAuthType("ADMIN");

setAuthMode("login");

setShowAuth(true);

};

const openFarmerRegister = () => {

clearAuthFields();

setAuthType("FARMER");

setAuthMode("register");

setShowAuth(true);

};

const closeAuth = () => {

setShowAuth(false);

clearAuthFields();

};

// REGISTER CUSTOMER OR FARMER

const handleRegister = async (e) => {

e.preventDefault();

setLoading(true);

const params = new URLSearchParams({

name: name.trim(),

email: email.trim(),

password,

role: authType,

});

try {

const response = await fetch(

`${API_URL}/auth/register?${params.toString()}`,

{ method: "POST" }

);

const result = await response.json().catch(() => ({}));

if (!response.ok) {

alert(result.message || `Registration failed (${response.status}).`);

return;

}

alert(

`${authType === "FARMER" ? "Farmer" : "Customer"} registration successful! Please log in.`

);

clearAuthFields();

setAuthMode("login");

} catch (error) {

console.error("Registration error:", error);

alert("Cannot connect to the backend. Check that Spring Boot is running.");

} finally {

setLoading(false);

}

};

// LOGIN CUSTOMER OR FARMER

const handleLogin = async (e) => {

e.preventDefault();

setLoading(true);

const params = new URLSearchParams({

email: email.trim(),

password,

role: authType,

});

try {

const response = await fetch(

`${API_URL}/auth/login?${params.toString()}`,

{ method: "POST" }

);

const result = await response.json().catch(() => ({}));

if (!response.ok) {

alert(result.message || `Login failed (${response.status}).`);

return;

}

setCurrentUser(result);

setShowAuth(false);

setCrop({ ...emptyCrop });

setCropMessage("");

clearAuthFields();

if (result.role === "FARMER") {

loadFarmerCrops(result.id);

}

} catch (error) {

console.error("Login error:", error);

alert("Cannot connect to the backend. Check that Spring Boot is running.");

} finally {

setLoading(false);

}

};

// LOAD FARMER'S CROPS

const loadFarmerCrops = async (farmerId) => {

setCropsLoading(true);

try {

const response = await fetch(

`${API_URL}/crops/farmer/${farmerId}`

);

if (!response.ok) {

throw new Error(`Request failed: ${response.status}`);

}

const result = await response.json();

setMyCrops(result);

} catch (error) {

console.error("Loading crops failed:", error);

setCropMessage(

"Unable to load your crops. Please check the backend."

);

} finally {

setCropsLoading(false);

}

};

// UPDATE CROP FORM

const handleCropChange = (e) => {

const { name, value } = e.target;

setCrop((previous) => ({

...previous,

[name]: value,

}));

};

// SUBMIT CROP TO BACKEND

const handleCropSubmit = async (e) => {

e.preventDefault();

if (!currentUser || currentUser.role !== "FARMER") {

setCropMessage("Please log in with a farmer account.");

return;

}

setCropLoading(true);

setCropMessage("");

const params = new URLSearchParams();

params.append("farmerId", String(currentUser.id));

params.append("name", crop.name.trim());

params.append("category", crop.category);

params.append("quantityKg", crop.quantityKg);

params.append("pricePerKg", crop.pricePerKg);

[

"wholesalePricePerKg",

"discount25Kg",

"discount50Kg",

"discount100Kg",

"description",

].forEach((field) => {

if (String(crop[field]).trim() !== "") {

params.append(field, String(crop[field]).trim());

}

});

try {

const response = await fetch(

`${API_URL}/crops?${params.toString()}`,

{ method: "POST" }

);

const result = await response.json().catch(() => ({}));

if (!response.ok) {

setCropMessage(

result.message || `Crop submission failed (${response.status}).`

);

return;

}

setCropMessage(

`Success! ${result.name} has been submitted for admin approval.`

);

setCrop({ ...emptyCrop });

await loadFarmerCrops(currentUser.id);

} catch (error) {

console.error("Crop submission error:", error);

setCropMessage(

"Cannot connect to the backend. Check that Spring Boot is running."

);

} finally {

setCropLoading(false);

}

};

const logout = () => {

setCartItems([]);

setShowCart(false);

setCartMessage("");

setCurrentUser(null);

setMyCrops([]);

setCrop({ ...emptyCrop });

setCropMessage("");

clearAuthFields();

};

// ADMIN DASHBOARD

if (currentUser && currentUser.role === "ADMIN") {

return (

<div className="app">

<nav className="navbar">

<div className="logo">🌱 Rural Connect</div>

<div className="nav-buttons">



<button className="login-btn" onClick={logout}>Logout</button>

</div>

</nav>

<AdminDashboard />

<footer>

<h2>🌱 Rural Connect</h2>

<p>Connecting Farmers Directly With Consumers</p>

<p className="copyright">

© 2026 Rural Connect. All rights reserved.

</p>

</footer>

</div>

);

}

// CUSTOMER AND FARMER DASHBOARDS

if (currentUser) {

const isFarmer = currentUser.role === "FARMER";

return (

<div className={`app ${!isFarmer ? "customer-store-app" : "farmer-app"}`}>

<nav className="navbar customer-store-navbar">

<div className="logo">🌱 Rural Connect</div>

{!isFarmer && <div className="store-nav-message">Fresh from farms · Fair prices · Direct to you</div>}

<div className="nav-buttons">
{!isFarmer && (
  <button className="cart-btn" type="button" onClick={() => setShowCart((open) => !open)}>
    🛒 Cart ({cartCount})
  </button>
)}
<button className="login-btn" onClick={logout}>Logout</button>
</div>

</nav>

<section className={`dashboard-section ${!isFarmer ? "customer-store-section" : ""}`}>

<div className={`dashboard-content ${!isFarmer ? "customer-store-content" : ""}`}>

{!isFarmer && <div className="store-welcome-banner"><div><span className="store-eyebrow">RURAL CONNECT MARKETPLACE</span><h1>Fresh picks, straight from the farm.</h1><p>Shop seasonal produce from local farmers at transparent prices.</p><div className="store-benefits"><span>✓ Farmer-direct</span><span>✓ Fresh produce</span><span>✓ Clear pricing</span></div></div><div className="store-banner-art" aria-hidden="true">🥬🍅🌽</div></div>}

{!isFarmer && <div className="store-shortcuts"><button type="button" onClick={() => document.getElementById("customer-crop-search")?.focus()}>🔎 Find produce</button><button type="button" onClick={openCustomerCart}>🛒 Cart ({cartCount})</button><button type="button" onClick={() => { setShowOrderDetails((shown) => !shown); if (!showOrderDetails) loadOrders("customer", currentUser.id); document.getElementById("customer-orders")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>📦 My Orders</button></div>}

<h1 className={!isFarmer ? "customer-welcome-heading" : ""}>

Welcome, <span>{currentUser.name}!</span>

</h1>

<p>

{isFarmer

? "Manage your crops and submit your products for approval."

: "Welcome to Rural Connect. Discover fresh products directly from farmers."}

</p>

{!isFarmer && showCart && (

<section id="customer-shopping-cart" className="dashboard-card shopping-cart store-cart-panel" aria-label="Shopping cart">

<h2>🛒 Your Shopping Cart</h2>

{cartMessage && <p className="crop-message" role="status">{cartMessage}</p>}

{cartItems.length === 0 ? <p>Your cart is empty. Browse crops and add your favourites!</p> : <>

{cartItems.map((entry) => <div className="cart-item" key={entry.id}>

<div><h3>{entry.name}</h3><p>Farmer: {entry.farmerName || "Farmer"}</p><p>Price: ₹{entry.pricePerKg}/kg</p>

<div className="cart-quantity"><button type="button" onClick={() => changeCartQuantity(entry.id, -1)} aria-label={`Decrease ${entry.name} quantity`}>−</button><span>{entry.cartQuantity} kg</span><button type="button" onClick={() => changeCartQuantity(entry.id, 1)} aria-label={`Increase ${entry.name} quantity`}>+</button></div>

<p>Subtotal: ₹{(Number(entry.pricePerKg || 0) * entry.cartQuantity).toFixed(2)}</p></div>

<button type="button" className="remove-cart-btn" onClick={() => removeFromCart(entry.id)}>Remove</button></div>)}

<h3 className="cart-total">Total: ₹{cartTotal.toFixed(2)}</h3>
<div className="checkout-address-panel">
  <h3>📍 Delivery details</h3>
  <p>Where should we deliver your fresh order?</p>
  <label htmlFor="delivery-phone">Mobile number</label>
  <input id="delivery-phone" type="tel" inputMode="numeric" maxLength={10} value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" required />
  <label htmlFor="delivery-address">Full delivery address</label>
  <textarea id="delivery-address" rows={3} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="House/flat, street, area, city, state, PIN code" required />
</div>
<button type="button" className="primary-btn" onClick={placeCartOrders} disabled={placingOrder}>
  {placingOrder ? "Placing order..." : "Order Now"}
</button>
</>}
{orderMessage && <p className="crop-message" role="status">{orderMessage}</p>}

<button type="button" className="secondary-btn" onClick={() => setShowCart(false)}>Continue Shopping</button>

</section>

)}

{!isFarmer && cartToast && (
  <div className="store-toast" role="status">
    <span className="store-toast-check">✓</span>
    <div><strong>Item added to cart</strong><p>{cartToast}</p></div>
    <button type="button" onClick={openCustomerCart}>View cart</button>
    <button type="button" className="store-toast-close" aria-label="Dismiss notification" onClick={() => setCartToast("")}>×</button>
  </div>
)}

{!isFarmer && showOrderSuccess && (
  <div className="store-modal-backdrop" role="presentation">
    <div className="store-success-modal" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
      <button type="button" className="store-modal-close" aria-label="Close" onClick={() => setShowOrderSuccess(false)}>×</button>
      <div className="party-poppers" aria-hidden="true">🎉 ✨ 🎊 ✨ 🎉</div>
      <div className="store-success-icon">✓</div>
      <h2 id="order-success-title">Order placed successfully!</h2>
      <p>Your order has been received. You can view its details and delivery progress anytime from <strong>My Orders</strong>.</p>
      {confirmedDelivery && <div className="success-delivery-address"><strong>Delivering to</strong><span>{confirmedDelivery.address}</span><small>Contact: {confirmedDelivery.phone}</small></div>}
      <div className="party-poppers party-poppers-bottom" aria-hidden="true">🎊 🎉 ✨ 🎉 🎊</div>
      <div className="store-success-actions">
        <button type="button" className="primary-btn" onClick={() => { setShowOrderSuccess(false); setShowOrderDetails(true); document.getElementById("customer-orders")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>View order & track</button>
        <button type="button" className="secondary-btn" onClick={() => setShowOrderSuccess(false)}>Continue shopping</button>
      </div>
    </div>
  </div>
)}

{!isFarmer && (
  <section className="dashboard-card ecommerce-orders" id="customer-orders">
    <div className="orders-section-heading">
      <div><span className="store-eyebrow">YOUR PURCHASES</span><h2>📦 My Orders</h2><p>Open your orders whenever you want to view details and delivery tracking.</p></div>
      <div className="orders-heading-actions">
        <button type="button" className="secondary-btn" onClick={() => { const next = !showOrderDetails; setShowOrderDetails(next); if (next) loadOrders("customer", currentUser.id); }} aria-expanded={showOrderDetails}>{showOrderDetails ? "Hide order details" : "View orders"}</button>
        {showOrderDetails && <button type="button" className="secondary-btn" onClick={() => loadOrders("customer", currentUser.id)} disabled={ordersLoading}>{ordersLoading ? "Refreshing…" : "↻ Refresh"}</button>}
      </div>
    </div>
    {showOrderDetails && <>
    {orderMessage && <p className="order-feedback" role="status">{orderMessage}</p>}
    {ordersLoading ? <p className="orders-empty">Loading your orders…</p> : myOrders.length === 0 ? (
      <div className="orders-empty"><span className="orders-empty-icon">🛍️</span><h3>No orders yet</h3><p>Once you place an order, its details and delivery progress will appear here.</p><button type="button" className="primary-btn" onClick={() => document.getElementById("customer-crop-search")?.focus()}>Explore fresh crops</button></div>
    ) : <div className="ecommerce-order-list">
      {myOrders.map((order) => <article className="ecommerce-order-card" key={order.orderId}>
        <div className="order-card-topline"><div><span className="order-label">ORDER PLACED</span><strong>{formatOrderDate(order.createdAt)}</strong></div><div><span className="order-label">ORDER NUMBER</span><strong>#{order.orderId}</strong></div><div className="order-status-pill">{String(order.status || "PLACED").replaceAll("_", " ")}</div></div>
        <div className="order-card-product"><div className="order-product-icon">🌿</div><div className="order-product-info"><h3>{order.cropName || "Farm-fresh crop"}</h3><p>Sold by {order.farmerName || "Rural Connect farmer"}</p><p>Quantity: <strong>{order.quantityKg} kg</strong></p></div><div className="order-price">₹{Number(order.totalPrice || 0).toFixed(2)}<small>Order total</small></div></div>
        <div className="order-delivery-row"><div className="order-delivery-estimate">🚚 Expected delivery: <strong>{getExpectedDelivery(order.createdAt, order.status)}</strong></div><button type="button" className="secondary-btn order-track-now" onClick={() => document.getElementById(`order-tracking-${order.orderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>Track now</button></div>
        {(orderAddresses[order.orderId] || confirmedDelivery) && <div className="order-address-summary"><strong>📍 Delivery address</strong><span>{(orderAddresses[order.orderId] || confirmedDelivery).address}</span><small>Contact: {(orderAddresses[order.orderId] || confirmedDelivery).phone}</small></div>}
        <div className="order-tracking-block" id={`order-tracking-${order.orderId}`}><div className="tracking-title"><strong>{order.status === "DELIVERED" ? "Delivered" : order.status === "CANCELLED" ? "Order update" : "Delivery tracking"}</strong><span>Current status: {String(order.status || "PLACED").replaceAll("_", " ")}</span></div><OrderProgress status={order.status} /></div>
      </article>)}
    </div>}
    </>}
  </section>
)}
{!isFarmer && (

<section className="dashboard-card customer-marketplace store-marketplace">

<div className="store-section-heading"><div><span className="store-eyebrow">SHOP LOCAL</span><h2>Fresh from our farmers</h2><p>Browse approved crops, compare prices, and add your favourites to your cart.</p></div><span className="store-product-count">{approvedCrops.length} products</span></div>

<p>Search approved crops, compare prices, and find the farmers who grow them.</p>

<div className="customer-search-controls">

<label className="sr-only" htmlFor="customer-crop-search">Search crops or farmers</label>

<input

id="customer-crop-search"

type="search"

value={customerSearch}

onChange={(e) => setCustomerSearch(e.target.value)}

placeholder="Search crop or farmer name..."

/>

<label className="sr-only" htmlFor="customer-crop-category">Filter by category</label>

<select

id="customer-crop-category"

value={customerCategory}

onChange={(e) => setCustomerCategory(e.target.value)}

>

<option value="All">All categories</option>

<option value="Vegetables">Vegetables</option>

<option value="Fruits">Fruits</option>

<option value="Grains">Grains</option>

<option value="Pulses">Pulses</option>

<option value="Spices">Spices</option>

<option value="Organic">Organic</option>

</select>

<button

className="secondary-btn"

type="button"

onClick={loadApprovedCrops}

disabled={approvedCropsLoading}

>

{approvedCropsLoading ? "Refreshing..." : "Refresh crops"}

</button>

</div>

{approvedCropsLoading ? (

<p role="status">Loading approved crops...</p>

) : approvedCropsError ? (

<p className="crop-message" role="alert">{approvedCropsError}</p>

) : (() => {

const searchTerm = customerSearch.trim().toLowerCase();

const filteredCrops = approvedCrops.filter((item) => {

const matchesSearch =

String(item.name || "").toLowerCase().includes(searchTerm) ||

String(item.farmerName || "").toLowerCase().includes(searchTerm) ||

String(item.category || "").toLowerCase().includes(searchTerm);

const matchesCategory = customerCategory === "All" ||

String(item.category || "").toLowerCase() === customerCategory.toLowerCase();

return matchesSearch && matchesCategory;

});

return filteredCrops.length === 0 ? (

<p>No matching approved crops found. Try another crop or farmer name.</p>

) : (

<div className="category-container customer-crop-grid">

{filteredCrops.map((item) => (

<article className="category-card approved-crop-card store-product-card" key={item.id}>

<div className="approved-crop-icon store-product-art">

{item.category?.toLowerCase() === "fruits" ? "🍎" :

item.category?.toLowerCase() === "grains" ? "🌾" :

item.category?.toLowerCase() === "pulses" ? "🫘" :

item.category?.toLowerCase() === "spices" ? "🌶️" : "🥕"}

</div>

<h3>{item.name}</h3>

<p>Category: {item.category}</p>

<p>Available quantity: {item.quantityKg} kg</p>

<p className="customer-crop-price"><strong>₹{item.pricePerKg}/kg</strong></p>

{item.wholesalePricePerKg != null && (

<p>Wholesale price: ₹{item.wholesalePricePerKg}/kg</p>

)}

<div className="farmer-review-summary">

<h4>👨‍🌾 Farmer: {item.farmerName || "Farmer details unavailable"}</h4>

<p>⭐ Reviews: Not available yet</p>

<small>Verified customer reviews will appear here once the review feature is connected.</small>

</div>

{item.description && <p>{item.description}</p>}

<button type="button" className="primary-btn add-to-cart-btn store-add-button" onClick={() => addToCart(item)}>＋ Add to Cart</button>

</article>

))}

</div>

);

})()}

</section>

)}

{isFarmer && (

<>

<div className="dashboard-card">
  <h2>📦 Order Tracking</h2>
  <p>View customer orders for your approved crops and check their current status.</p>
  <button
    type="button"
    className="secondary-btn"
    onClick={() => loadOrders("farmer", currentUser.id)}
    disabled={ordersLoading}
  >
    {ordersLoading ? "Loading orders..." : "Refresh Orders"}
  </button>
  {orderMessage && <p className="crop-message" role="status">{orderMessage}</p>}
  {ordersLoading ? <p>Loading orders...</p> : myOrders.length === 0 ? (
    <p>No orders for your crops yet. Refresh after a customer places an order.</p>
  ) : (
    <div className="crop-list">
      {myOrders.map((order) => (
        <div className="ecommerce-order-card farmer-order-card" key={order.orderId}>
          <div className="order-card-topline"><div><span className="order-label">ORDER PLACED</span><strong>{formatOrderDate(order.createdAt)}</strong></div><div><span className="order-label">ORDER NUMBER</span><strong>#{order.orderId}</strong></div><div className="order-status-pill">{String(order.status || "PLACED").replaceAll("_", " ")}</div></div>
          <div className="order-card-product"><div className="order-product-icon">📦</div><div className="order-product-info"><h3>{order.cropName}</h3><p>Customer: {order.customerName || "Customer"}</p><p>Quantity: <strong>{order.quantityKg} kg</strong></p></div><div className="order-price">₹{Number(order.totalPrice || 0).toFixed(2)}<small>Order total</small></div></div>
          <div className="order-tracking-block"><div className="tracking-title"><strong>Fulfilment progress</strong><span>Current status: {String(order.status || "PLACED").replaceAll("_", " ")}</span></div><OrderProgress status={order.status} /></div>
        </div>
      ))}
    </div>
  )}
</div>

<div className="dashboard-card">

<h2>🌾 Add a Crop</h2>

<p>

Enter your crop details. New submissions require admin

approval before appearing to customers.

</p>

<form className="crop-form" onSubmit={handleCropSubmit}>

<label htmlFor="crop-name">Crop name</label>

<input

id="crop-name"

name="name"

value={crop.name}

onChange={handleCropChange}

placeholder="e.g. Tomatoes"

required

/>

<label htmlFor="crop-category">Category</label>

<select

id="crop-category"

name="category"

value={crop.category}

onChange={handleCropChange}

required

>

<option value="Vegetables">Vegetables</option>

<option value="Fruits">Fruits</option>

<option value="Grains">Grains</option>

<option value="Pulses">Pulses</option>

<option value="Spices">Spices</option>

<option value="Organic">Organic</option>

<option value="Other">Other</option>

</select>

<label htmlFor="crop-quantity">Available quantity (kg)</label>

<input

id="crop-quantity"

name="quantityKg"

type="number"

min="0.01"

step="0.01"

value={crop.quantityKg}

onChange={handleCropChange}

placeholder="e.g. 100"

required

/>

<label htmlFor="crop-price">Individual price per kg (₹)</label>

<input

id="crop-price"

name="pricePerKg"

type="number"

min="0.01"

step="0.01"

value={crop.pricePerKg}

onChange={handleCropChange}

placeholder="e.g. 40"

required

/>

<label htmlFor="crop-wholesale">

Wholesale price per kg (₹, optional)

</label>

<input

id="crop-wholesale"

name="wholesalePricePerKg"

type="number"

min="0.01"

step="0.01"

value={crop.wholesalePricePerKg}

onChange={handleCropChange}

placeholder="e.g. 35"

/>

<h3>Wholesale discounts (₹ per kg off)</h3>

<p>

Enter the discount per kg for each order size, or leave

it blank if you do not offer one.

</p>

<label htmlFor="discount-25">Discount for 25 kg (₹/kg)</label>

<input

id="discount-25"

name="discount25Kg"

type="number"

min="0"

step="0.01"

value={crop.discount25Kg}

onChange={handleCropChange}

placeholder="e.g. 1"

/>

<label htmlFor="discount-50">Discount for 50 kg (₹/kg)</label>

<input

id="discount-50"

name="discount50Kg"

type="number"

min="0"

step="0.01"

value={crop.discount50Kg}

onChange={handleCropChange}

placeholder="e.g. 2"

/>

<label htmlFor="discount-100">Discount for 100 kg (₹/kg)</label>

<input

id="discount-100"

name="discount100Kg"

type="number"

min="0"

step="0.01"

value={crop.discount100Kg}

onChange={handleCropChange}

placeholder="e.g. 3"

/>

<label htmlFor="crop-description">Description (optional)</label>

<textarea

id="crop-description"

name="description"

rows="4"

value={crop.description}

onChange={handleCropChange}

placeholder="Describe crop quality, harvest date, or other details"

/>

<button

className="auth-submit"

type="submit"

disabled={cropLoading}

>

{cropLoading ? "Submitting..." : "Submit Crop for Approval"}

</button>

</form>

{cropMessage && (

<p className="crop-message" role="status">

{cropMessage}

</p>

)}

</div>

<div className="dashboard-card">

<h2>📦 My Crops</h2>

<button

className="secondary-btn"

onClick={() => loadFarmerCrops(currentUser.id)}

disabled={cropsLoading}

>

{cropsLoading ? "Loading..." : "Refresh Crops"}

</button>

{cropsLoading ? (

<p>Loading your crops...</p>

) : myCrops.length === 0 ? (

<p>You haven't submitted any crops yet.</p>

) : (

<div className="crop-list">

{myCrops.map((item) => (

<div className="crop-list-item" key={item.id}>

<h3>{item.name}</h3>

<p>Category: {item.category}</p>

<p>Available: {item.quantityKg} kg</p>

<p>Price: ₹{item.pricePerKg}/kg</p>

<p>

Status:{" "}

{item.approved

? "Approved"

: "Pending admin approval"}

</p>

</div>

))}

</div>

)}

</div>

</>

)}

</div>

</section>

<footer>

<h2>🌱 Rural Connect</h2>

<p>Connecting Farmers Directly With Consumers</p>

<p className="copyright">

© 2026 Rural Connect. All rights reserved.

</p>

</footer>

</div>

);

}

return (

<div className="app">

{/* NAVBAR */}

<nav className="navbar">

<div className="logo">🌱 Rural Connect</div>

<div className="nav-links">

<a href="#">Home</a>

<a href="#categories">Farmers</a>

<a href="#categories">Crops</a>

<a href="#why">About</a>

</div>

<div className="nav-buttons">

<button className="login-btn" onClick={openCustomerLogin}>

Customer Login

</button>

<button className="farmer-login-btn" onClick={openFarmerLogin}>

Farmer Login

</button>

<button className="login-btn" onClick={openAdminLogin}>

Admin Login

</button>

<button className="cart-btn" onClick={openCustomerLogin}>

🛒 Cart

</button>

</div>

</nav>

{/* HERO */}

<section className="hero">

<div className="hero-content">

<h1>

Fresh From Farmers,

<br />

<span>Directly To You</span>

</h1>

<p>

Buy fresh and quality agricultural products directly from trusted

farmers without unnecessary middlemen.

</p>

<div className="search-box">

<input

type="text"

placeholder="Search for crops, vegetables or farmers..."

/>

<button

onClick={() =>

document

.getElementById("categories")

?.scrollIntoView({ behavior: "smooth" })

}

>

Search

</button>

</div>

<div className="hero-buttons">

<button

className="primary-btn"

onClick={() =>

document

.getElementById("categories")

?.scrollIntoView({ behavior: "smooth" })

}

>

Explore Crops

</button>

<button className="secondary-btn" onClick={openFarmerRegister}>

Become a Farmer

</button>

</div>

</div>

<div className="hero-image">

<div className="farmer-icon">👨‍🌾</div>

<div className="crop-icons">🌾 🥕 🍅 🌽 🥔</div>

</div>

</section>

{/* CATEGORIES */}

<section className="categories" id="categories">

<h2>Explore Fresh Crops</h2>

<p className="section-text">

Directly sourced from farmers near you

</p>

<div className="category-container">

<div className="category-card">

🌾

<h3>Grains</h3>

<p>Rice, Wheat, Maize</p>

</div>

<div className="category-card">

🥕

<h3>Vegetables</h3>

<p>Fresh Farm Vegetables</p>

</div>

<div className="category-card">

🍎

<h3>Fruits</h3>

<p>Fresh Seasonal Fruits</p>

</div>

<div className="category-card">

🌱

<h3>Organic</h3>

<p>Natural Farm Products</p>

</div>

</div>

</section>

{/* WHY RURAL CONNECT */}

<section className="why-section" id="why">

<h2>Why Rural Connect?</h2>

<div className="features">

<div className="feature">

<div>🚜</div>

<h3>Direct From Farmers</h3>

<p>

Connect directly with farmers and purchase fresh agricultural

products.

</p>

</div>

<div className="feature">

<div>💰</div>

<h3>Fair Prices</h3>

<p>

Farmers decide their prices and customers get transparent pricing.

</p>

</div>

<div className="feature">

<div>⭐</div>

<h3>Trusted Reviews</h3>

<p>

Read genuine reviews from customers who actually purchased

products.

</p>

</div>

<div className="feature">

<div>📦</div>

<h3>Easy Tracking</h3>

<p>Track your order from the farmer to your doorstep.</p>

</div>

</div>

</section>

{/* LOGIN / REGISTER POPUP */}

{showAuth && (

<div className="auth-overlay">

<div className="auth-box">

<button className="close-auth" onClick={closeAuth}>

✕

</button>

<h2>

{authMode === "login"

? authType === "ADMIN"

? "Admin Login 🔐"

: authType === "FARMER"

? "Farmer Login 🌾"

: "Customer Login 🛒"

: authType === "FARMER"

? "Create Farmer Account 🌾"

: "Create Customer Account 🛒"}

</h2>

<p>

{authMode === "login"

? authType === "ADMIN"

? "Sign in to review and approve crop submissions"

: authType === "FARMER"

? "Login to manage your farm and crops"

: "Login to shop fresh products"

: authType === "FARMER"

? "Join Rural Connect as a farmer"

: "Join Rural Connect as a customer"}

</p>

<form

onSubmit={authMode === "login" ? handleLogin : handleRegister}

>

{authMode === "register" && (

<input

type="text"

placeholder="Full Name"

value={name}

onChange={(e) => setName(e.target.value)}

required

/>

)}

<input

type="email"

placeholder="Email"

value={email}

onChange={(e) => setEmail(e.target.value)}

required

/>

<input

type="password"

placeholder="Password"

value={password}

onChange={(e) => setPassword(e.target.value)}

minLength={8}

required

/>

<button

type="submit"

className="auth-submit"

disabled={loading}

>

{loading

? "Please wait..."

: authMode === "login"

? authType === "ADMIN"

? "Admin Login"

: "Login"

: authType === "FARMER"

? "Create Farmer Account"

: "Create Customer Account"}

</button>

</form>

{authType !== "ADMIN" && (

<p className="auth-switch">

{authMode === "login"

? "Don't have an account?"

: "Already have an account?"}

<button

type="button"

disabled={loading}

onClick={() => {

clearAuthFields();

setAuthMode(

authMode === "login" ? "register" : "login"

);

}}

>

{authMode === "login" ? "Register" : "Login"}

</button>

</p>

)}

</div>

</div>

)}

{/* FOOTER */}

<footer>

<h2>🌱 Rural Connect</h2>

<p>Connecting Farmers Directly With Consumers</p>

<p className="copyright">

© 2026 Rural Connect. All rights reserved.

</p>

</footer>

</div>

);

}

export default App;