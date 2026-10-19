import { getActiveLine } from './data/lines.js';
import RollerPage from './rollerpage.jsx';
import { ZebraPage, ShangriLaPage, RomanPage, CellularPage, DraperyPage } from './linepages.jsx';

const PAGES = { roller: RollerPage, zebra: ZebraPage, 'shangri-la': ShangriLaPage, roman: RomanPage, cellular: CellularPage, drapery: DraperyPage };

// One redesigned page per product line; the layout they share is in lineshell.jsx.
export default function LinePage({ slug, navigate, addToQuote }) {
  const line = getActiveLine(slug);
  const Page = line && PAGES[line.id];
  return Page ? <Page line={line} navigate={navigate} addToQuote={addToQuote} /> : null;
}
