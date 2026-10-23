// Privacy policy, terms of sale and the "Page not found" page. The privacy text describes what the site does today (Google sign-in,
// Supabase, Vercel, Resend, no online payment). Anything we cannot know from the code is a visible [placeholder] (class legal-todo)
// that the owner fills in; docs/legal-needs.md lists them. Both legal pages are marked noindex in pageMeta.js until that is done.
import { Footer } from './customer.jsx';
import { SITE } from './data/site.js';

const Todo = ({ children }) => <mark className="legal-todo">[{children}]</mark>;

const linkTo = (navigate, path) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault(); navigate(path);
};

const LegalShell = ({ title, updated, navigate, children }) => (
  <div className="page-fade s2 s2-inner">
    <section className="s2-wrap s2-page-head">
      <div>
        <p className="s2-eyebrow">Love's Blinds</p>
        <h1 className="s2-page-title">{title}</h1>
        <p className="s2-page-lede">Last updated <Todo>date</Todo>. Questions about this page? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or call <a href={SITE.phoneHref}>{SITE.phone}</a>.</p>
      </div>
    </section>
    <section className="s2-wrap s2-page-body legal">{children}</section>
    <Footer navigate={navigate} />
  </div>
);

export function PrivacyPage({ navigate }) {
  return (
    <LegalShell title="Privacy policy" navigate={navigate}>
      <h2>Who we are</h2>
      <p>Love's Blinds (<Todo>legal business name and address</Todo>) sells custom made-to-measure window treatments through this website. This page explains what we collect, why, and who helps us handle it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>When you send an order:</strong> your name, email, phone number and shipping address, the blinds you chose (product, color, size, room and window labels, options) and any notes. We also keep the estimate you were shown.</li>
        <li><strong>When you send a message:</strong> your name, email, phone number (if you give it), the topic and your message.</li>
        <li><strong>When you sign in with Google:</strong> your name, email address and profile picture from your Google account. We use them to recognize you and to save your orders. We never see your Google password.</li>
        <li><strong>Your profile (optional):</strong> the phone number and shipping address you save so we can fill in your next order.</li>
        <li><strong>Saved orders and carts:</strong> if you are signed in, your carts and sent orders are saved to your account. If you are not, your cart stays in your own browser.</li>
        <li><strong>Protection against spam:</strong> a scrambled (hashed) form of your network address and email address, kept for a short time to limit how many orders and messages can be sent in an hour. We do not store the address itself.</li>
      </ul>
      <p>We do not take payment on this website, so we never receive or store card numbers. We do not use advertising or analytics trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To prepare and confirm your estimate and order, contact you about measurements, price and delivery, and answer your messages.</li>
        <li>To email you a copy of what you sent.</li>
        <li>To keep the site safe and stop abuse.</li>
        <li>To keep our own records of orders and messages. <Todo>retention: how long you keep orders and messages</Todo></li>
      </ul>
      <p>We do not sell your information.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li><strong>Supabase</strong> stores accounts, saved carts and orders, sent orders and messages in a database.</li>
        <li><strong>Vercel</strong> hosts the website and runs the server code that receives your order.</li>
        <li><strong>Resend</strong> sends the emails (our copy of your order and the confirmation to you).</li>
        <li><strong>Google</strong> provides Sign in with Google. Google's own privacy policy applies to your Google account.</li>
      </ul>
      <p>These companies may process data in the United States and other countries. We share your order details with our suppliers and shipping carriers only as needed to make and deliver your order. <Todo>confirm: supplier names or "our manufacturing partners"</Todo></p>

      <h2>Cookies and browser storage</h2>
      <p>The site saves your cart, your unfinished blinds and your sign-in in your browser's storage so they are still there when you come back. Google may set its own cookies when you use Sign in with Google. You can clear this any time in your browser settings; you will be signed out and unsent carts will be lost.</p>

      <h2>Your choices</h2>
      <p>You can ask to see, correct or delete the information we hold about you by emailing <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. You can edit your saved name, phone and address on your <a href="/profile" onClick={linkTo(navigate, '/profile')}>profile</a> page. We may need to keep some records (for example orders in progress) as the law requires. <Todo>add any rights that apply where you sell, e.g. California or EU/UK, if you sell there</Todo></p>

      <h2>Children</h2>
      <p>This site is not meant for children under 13 and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this page we will update the date above.</p>
    </LegalShell>
  );
}

export function TermsPage({ navigate }) {
  return (
    <LegalShell title="Terms of sale" navigate={navigate}>
      <h2>How ordering works</h2>
      <p>The price you see while building a blind is an <strong>estimate</strong>. When you send your order, we review your measurements and choices and email you the final price within 48 hours. <strong>No payment is taken on this website.</strong> Nothing is made until you have agreed to the final price and we have confirmed how you will pay. <Todo>payment methods and when payment is due, e.g. deposit before production</Todo></p>

      <h2>Made to measure</h2>
      <p>Every blind is made to the sizes you give us, so please measure carefully using our <a href="/measure" onClick={linkTo(navigate, '/measure')}>measuring guide</a>. If a size is wrong, the blind may not fit. <Todo>who bears the cost of a wrong measurement</Todo></p>

      <h2>Colors and fabrics</h2>
      <p>Colors on a screen can look different from the real fabric. <Todo>samples policy: do you offer samples, and are they free?</Todo></p>

      <h2>Lead times and shipping</h2>
      <p>Made-to-order blinds take time to produce and ship. <Todo>typical production time, e.g. X to Y weeks</Todo> <Todo>shipping cost, countries you ship to, carriers, customs and duties</Todo> Delivery dates are estimates.</p>

      <h2>Returns and cancellations</h2>
      <p>Because each blind is custom made, <Todo>returns policy: for example no returns on made-to-measure items except damage or our error</Todo>. <Todo>cancellation window, and whether a deposit is refundable</Todo> If your order arrives damaged or not as ordered, contact us within <Todo>number of days</Todo> days of delivery.</p>

      <h2>Warranty</h2>
      <p><Todo>warranty terms: length, what is covered (mechanisms, fabric, motors), what is not (misuse, sun fading, wear), and how to make a claim</Todo></p>

      <h2>Installation</h2>
      <p><Todo>whether you offer installation, or the customer installs, and any installation guide or responsibility</Todo></p>

      <h2>Pricing and mistakes</h2>
      <p>If we make a pricing or listing mistake we will tell you before making your order and you can accept the correct price or cancel.</p>

      <h2>Limits and law</h2>
      <p><Todo>limitation of liability and governing law (state), as advised by your lawyer</Todo></p>

      <h2>Contact</h2>
      <p>Love's Blinds (<Todo>legal business name and address</Todo>), <a href={`mailto:${SITE.email}`}>{SITE.email}</a>, <a href={SITE.phoneHref}>{SITE.phone}</a>.</p>
    </LegalShell>
  );
}

export function NotFoundPage({ navigate }) {
  return (
    <div className="page-fade s2 s2-inner">
      <section className="s2-wrap s2-page-head">
        <div>
          <p className="s2-eyebrow">Error 404</p>
          <h1 className="s2-page-title">Page not found</h1>
          <p className="s2-page-lede">We couldn't find that page. It may have moved, or the link may have a typo.</p>
          <div className="notfound-links">
            <a className="s2-btn s2-btn-brass" href="/products" onClick={linkTo(navigate, '/products')}>See products</a>
            <a className="s2-btn s2-btn-line" href="/contact" onClick={linkTo(navigate, '/contact')}>Contact us</a>
          </div>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

const PAGES = { privacy: PrivacyPage, terms: TermsPage, notfound: NotFoundPage };
export default function Legal({ page, navigate }) { const Page = PAGES[page]; return <Page navigate={navigate} />; }
