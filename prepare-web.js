// index.html'i Android uygulaması için hazırlar:
//  1) CDN kütüphanelerini (Bootstrap, Chart.js, Font Awesome) uygulamanın içine gömer -> internetsiz çalışır
//  2) CSV/JSON "indir" butonlarının Android'de çalışması için küçük bir yardımcı ekler
const fs = require('fs');
const path = require('path');

const root = __dirname;
const nm = (...p) => path.join(root, 'node_modules', ...p);
const www = path.join(root, 'www');

function copy(src, dest) {
  if (!fs.existsSync(src)) throw new Error('Bulunamadı: ' + src);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

// --- Kütüphaneleri kopyala ---
copy(nm('bootstrap', 'dist', 'css', 'bootstrap.min.css'), path.join(www, 'vendor/bootstrap/bootstrap.min.css'));
copy(nm('bootstrap', 'dist', 'js', 'bootstrap.bundle.min.js'), path.join(www, 'vendor/bootstrap/bootstrap.bundle.min.js'));
copy(nm('@fortawesome', 'fontawesome-free', 'css', 'all.min.css'), path.join(www, 'vendor/fontawesome/css/all.min.css'));
copy(nm('@fortawesome', 'fontawesome-free', 'webfonts'), path.join(www, 'vendor/fontawesome/webfonts'));

const chartDir = nm('chart.js', 'dist');
const chartFile = ['chart.umd.min.js', 'chart.umd.js'].find(f => fs.existsSync(path.join(chartDir, f)));
if (!chartFile) throw new Error('Chart.js UMD dosyası bulunamadı');
copy(path.join(chartDir, chartFile), path.join(www, 'vendor/chart/chart.umd.js'));

// --- HTML'deki CDN adreslerini yerel dosyalarla değiştir ---
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const rules = [
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/css\/all\.min\.css/g, 'vendor/fontawesome/css/all.min.css'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.3\.0\/dist\/css\/bootstrap\.min\.css/g, 'vendor/bootstrap/bootstrap.min.css'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.3\.0\/dist\/js\/bootstrap\.bundle\.min\.js/g, 'vendor/bootstrap/bootstrap.bundle.min.js'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js(?=")/g, 'vendor/chart/chart.umd.js'],
];
for (const [re, to] of rules) {
  if (!re.test(html)) throw new Error('index.html içinde beklenen adres bulunamadı: ' + re);
  html = html.replace(re, to);
}
const left = html.match(/(?:src|href)="https?:\/\/(?:cdn|cdnjs)[^"]*"/g);
if (left) throw new Error('Gömülmemiş CDN adresi kaldı: ' + left.join(', '));

// --- Android'de dosya indirme/paylaşma yardımcısı ---
const shim = `<script>
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var blobs = {};
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) { var u = origCreate(b); blobs[u] = b; return u; };
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || '';
    if (this.download && href.indexOf('blob:') === 0 && blobs[href]) {
      var blob = blobs[href], name = this.download;
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = String(reader.result).split(',')[1];
        var P = cap.Plugins;
        P.Filesystem.writeFile({ path: name, data: base64, directory: 'CACHE' })
          .then(function (r) { return P.Share.share({ title: name, url: r.uri, dialogTitle: 'Kaydet / Paylaş' }); })
          .catch(function (e) { alert('Dosya kaydedilemedi: ' + (e && e.message ? e.message : e)); });
      };
      reader.readAsDataURL(blob);
      return;
    }
    return origClick.apply(this, arguments);
  };
})();
</script>`;
if (!html.includes('</head>')) throw new Error('</head> bulunamadı');
html = html.replace('</head>', shim + '\n</head>');

fs.writeFileSync(path.join(www, 'index.html'), html);
console.log('www/ hazır.');
