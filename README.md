# 💜 PhonePe Payment Integration — Backend + React Native

> **Ye repo ek complete reference hai PhonePe v2 SDK ko Node.js backend aur React Native mobile app mein integrate karne ke liye.**
> Isme WebView flow aur Native SDK flow dono cover kiye gaye hain.

---

## 📁 Folder Structure

```
phonepayIntegration_Backend_mobile_app-Code/
├── phonepay_backend_integration/     ← Node.js Backend ka code
│   ├── controllers/
│   │   └── PhonePayGateway.js        ← Payment initiate + status check logic
│   ├── routes/
│   │   └── PhonePayGatewayRoute.js   ← Express API routes
│   └── .env.example                  ← Required environment variables
│
└── reactnative_integration/          ← React Native Mobile App ka code
    ├── services/
    │   └── phonepePayment.js         ← Native SDK checkout service
    ├── components/
    │   └── PhonePayView/
    │       └── index.js              ← WebView modal component
    └── screens/
        ├── Payment/
        │   └── index.js              ← Payment screen (Booking wala)
        └── orderDetail/
            └── index.js              ← Order Detail screen (Pay Now button)
```

---

## ⚙️ Backend Setup (`phonepay_backend_integration`)

### Installation

```bash
npm install pg-sdk-node express mongoose
```

### Environment Variables

`.env.example` copy karke `.env` bana lo:

```bash
cp .env.example .env
```

```env
CLIENT_ID=your_phonepay_client_id
CLIENT_SECRET=your_phonepay_client_secret
```

> **CLIENT_ID aur CLIENT_SECRET** aapko [PhonePe Business Dashboard](https://business.phonepe.com) se milenge.

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/PhonePayGateway` | WebView flow ke liye payment initiate karo |
| `POST` | `/initiate-sdk` | Native SDK flow ke liye order token lo |
| `GET`  | `/PhonePayGatewayCheckStatus` | Payment status check karo |
| `POST` | `/PhonePayGatewayStatus` | PhonePe ka redirect callback |

---

### Backend Flow Samjho

```
App → POST /PhonePayGateway  →  PhonePe SDK  →  redirectUrl milta hai
App → WebView mein URL open  →  User pays    →  paymentstauspage pe redirect
App → GET /PhonePayGatewayCheckStatus  →  COMPLETED / PENDING / FAILED
```

---

## 📱 React Native Setup (`reactnative_integration`)

### Installation

```bash
npm install react-native-phonepe-pg react-native-webview
```

> Android ke liye `android/app/build.gradle` mein PhonePe SDK dependency add karo (refer official docs).

### 2 Flows Hain

#### 1️⃣ WebView Flow (Production-Ready ✅)
- `OpenPhonepayApi` call hota hai backend pe
- Backend se `redirectUrl` milta hai
- `PhonePayView` component uss URL ko WebView mein open karta hai
- Jab payment ho jaata hai, `/paymentstauspage` pe redirect hota hai
- App polling karta hai `CheckTransactionStatusApi` se

```js
// orderDetail ya payment screen se call karo
OpenPhonepayApi({ orderId, amount, mobileNumber, userId }, (loading, response) => {
  const url = response?.data?.data?.instrumentResponse?.redirectInfo?.url;
  if (url) {
    setPaymentUrl(url);
    setIsPhonePayModalVisible(true);
  }
});
```

#### 2️⃣ Native SDK Flow (Advanced)
- `PhonepeCheckout()` call hota hai `phonepePayment.js` se
- Backend se `token` leta hai `/initiate-sdk` endpoint pe
- PhonePe ka Native SDK directly open hota hai
- Result: `SUCCESS | FAILURE | INTERRUPTED`

```js
import { PhonepeCheckout } from '../services/phonepePayment';

PhonepeCheckout({ orderId, amount, mobileNumber, userId }, (result) => {
  if (result.funcStatus) {
    // Payment SUCCESS
  } else {
    // Payment FAILED ya CANCELLED
  }
});
```

---

## 🔑 Important Notes

- **Production Environment** use karo — `Env.PRODUCTION` backend mein aur `'PRODUCTION'` SDK init mein
- **Duplicate Transaction ID** se bachne ke liye har attempt mein `${orderId}_${Date.now()}` use kiya gaya hai
- **Cart clear** sirf successful payment ke baad karo — PENDING/FAILED pe mat karo
- **Status polling** — PhonePe kabhi kabhi `PENDING` return karta hai, isliye 2 second baad retry karo

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js, `pg-sdk-node` (PhonePe v2 SDK) |
| Database | MongoDB + Mongoose |
| Mobile | React Native |
| Payment | PhonePe v2 Standard Checkout SDK |

---

## 📞 Contact / Support

Koi issue aaye toh PhonePe Developer Docs dekho:
👉 [https://developer.phonepe.com](https://developer.phonepe.com)

---

> Degined by  💜  Prince
