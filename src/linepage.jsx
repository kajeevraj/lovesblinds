import { getActiveLine } from './data/lines.js';
import { useCart } from './lib/cart.js';
import RollerPage from './rollerpage.jsx';
import { ZebraPage, ShangriLaPage, RomanPage, CellularPage, DraperyPage } from './linepages.jsx';

const PAGES = { roller: RollerPage, zebra: ZebraPage, 'shangri-la': ShangriLaPage, roman: RomanPage, cellular: CellularPage, drapery: DraperyPage };

// One redesigned page per product line (the layout they share is in lineshell.jsx). With ?edit=<item id> the page opens
// with every choice of that item filled in, and its main button saves the changes to the same item.
export default function LinePage({ slug, navigate, editId = null }) {
  const line = getActiveLine(slug);
  const cart = useCart();
  const Page = line && PAGES[line.id];
  if (!Page) return null;
  const edit = editId ? cart.items.find((it) => it.id === editId && it.product.slug === line.slug) || null : null;
  if (editId && !edit && !cart.ready) return <div className="page-loading" aria-busy="true" />;       // the saved order is still loading
  // the key remounts the page when the item being edited changes, so its choices are filled in fresh
  return <Page key={edit ? edit.id : 'new'} line={line} navigate={navigate} edit={edit} />;
}
