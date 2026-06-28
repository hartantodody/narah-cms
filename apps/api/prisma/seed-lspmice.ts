/**
 * LSPMICE pilot seed.
 *
 * Provisions the `lspmice` site, all content types it needs to back the
 * lspmice.id Next.js front-end, and singleton entries populated from the
 * data currently hard-coded in `../../../lspmice/src/data/*.ts`.
 *
 * Re-runnable: every entity is upserted by stable key.
 *
 * Run with:  bun run prisma/seed-lspmice.ts
 */

import {
  ContentEntryStatus,
  ContentFieldType,
  Prisma,
  SiteRole,
  SiteStatus,
  type PrismaClient
} from '../generated/prisma/client'
import { API_KEY_SCOPES, generateApiKey } from '../src/utils/api-key'
import {
  acceptPoliciesForUser,
  createSeedClient,
  ensureDefaultPolicies,
  hashSeedPassword,
  upsertSeedUser
} from './seed-utils'

const { prisma, pool } = createSeedClient()

const SITE_SLUG = 'lspmice'
const SITE_NAME = 'LSP MICE'

type FieldDefinition = {
  label: string
  apiId: string
  type: ContentFieldType
  description?: string | null
  required?: boolean
  isList?: boolean
  sortOrder: number
  config?: Prisma.InputJsonValue | null
}

type ContentTypeDefinition = {
  name: string
  apiId: string
  description: string
  isSingleton: boolean
  fields: FieldDefinition[]
}

const contentTypeDefinitions: ContentTypeDefinition[] = [
  {
    name: 'Site Settings',
    apiId: 'site_settings',
    description: 'Global brand, navigation, and contact info.',
    isSingleton: true,
    fields: [
      { label: 'Name', apiId: 'name', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      { label: 'Legal Name', apiId: 'legal_name', type: ContentFieldType.TEXT, sortOrder: 1 },
      { label: 'Tagline', apiId: 'tagline', type: ContentFieldType.TEXT, sortOrder: 2 },
      { label: 'Description', apiId: 'description', type: ContentFieldType.TEXT, sortOrder: 3 },
      { label: 'Logo', apiId: 'logo', type: ContentFieldType.MEDIA, sortOrder: 4 },
      {
        label: 'Navigation',
        apiId: 'navigation',
        type: ContentFieldType.JSON,
        description: 'List of { label, href, exact?, matchPrefixes? } items.',
        sortOrder: 5
      },
      {
        label: 'Contact Info',
        apiId: 'contact_info',
        type: ContentFieldType.JSON,
        description:
          'Office details: { officeName, address, phone, whatsapp, contactPerson, email, officeHours, mapPlaceholder, mapsUrl, whatsappIntl }.',
        sortOrder: 6
      },
      {
        label: 'Contact Action Cards',
        apiId: 'contact_action_cards',
        type: ContentFieldType.JSON,
        description: 'List of { title, description, href, label } cards on the contact page.',
        sortOrder: 7
      }
    ]
  },
  {
    name: 'Home Page',
    apiId: 'home_page',
    description: 'Home page hero + section copy.',
    isSingleton: true,
    fields: [
      {
        label: 'Hero Slides',
        apiId: 'hero_slides',
        type: ContentFieldType.JSON,
        description:
          'List of { image, alt, eyebrow, title, accent, description, caption }.',
        sortOrder: 0
      },
      {
        label: 'Hero Content',
        apiId: 'hero',
        type: ContentFieldType.JSON,
        description:
          '{ actions: [{label, href, variant}], contactLabel, hoursLabel, scrollLabel }.',
        sortOrder: 1
      },
      {
        label: 'Highlights',
        apiId: 'highlights',
        type: ContentFieldType.JSON,
        description: 'List of { title, description } spotlight items.',
        sortOrder: 2
      },
      {
        label: 'About Section',
        apiId: 'about',
        type: ContentFieldType.JSON,
        sortOrder: 3
      },
      {
        label: 'About Panel',
        apiId: 'about_panel',
        type: ContentFieldType.JSON,
        description: '{ eyebrow, title, description, points: [...] }.',
        sortOrder: 4
      },
      {
        label: 'Certification Section',
        apiId: 'certification',
        type: ContentFieldType.JSON,
        sortOrder: 5
      },
      { label: 'News Section', apiId: 'news', type: ContentFieldType.JSON, sortOrder: 6 },
      { label: 'Contact Section', apiId: 'contact', type: ContentFieldType.JSON, sortOrder: 7 }
    ]
  },
  {
    name: 'About Page',
    apiId: 'about_page',
    description: 'About page (Tentang Kami) content.',
    isSingleton: true,
    fields: [
      {
        label: 'Overview Title',
        apiId: 'overview_title',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 0
      },
      {
        label: 'Overview Paragraphs',
        apiId: 'overview_paragraphs',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 1
      },
      {
        label: 'Vision',
        apiId: 'vision',
        type: ContentFieldType.TEXT,
        sortOrder: 2
      },
      {
        label: 'Missions',
        apiId: 'missions',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 3
      },
      {
        label: 'Functions',
        apiId: 'functions',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 4
      },
      {
        label: 'Work Foundations',
        apiId: 'work_foundations',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 5
      },
      {
        label: 'Structure Placeholder',
        apiId: 'structure_placeholder',
        type: ContentFieldType.TEXT,
        sortOrder: 6
      },
      {
        label: 'Legal Notes',
        apiId: 'legal_notes',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 7
      },
      {
        label: 'Structure Image',
        apiId: 'structure_image',
        type: ContentFieldType.MEDIA,
        sortOrder: 8
      }
    ]
  },
  {
    name: 'Assessor',
    apiId: 'assessor',
    description: 'LSP MICE assessor roster.',
    isSingleton: false,
    fields: [
      { label: 'Name', apiId: 'name', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      { label: 'Title', apiId: 'title', type: ContentFieldType.TEXT, sortOrder: 1 },
      { label: 'Photo', apiId: 'photo', type: ContentFieldType.MEDIA, sortOrder: 2 },
      { label: 'Bio', apiId: 'bio', type: ContentFieldType.RICH_TEXT, sortOrder: 3 },
      {
        label: 'Display Order',
        apiId: 'display_order',
        type: ContentFieldType.NUMBER,
        sortOrder: 4
      }
    ]
  },
  {
    name: 'Certification Scheme',
    apiId: 'certification_scheme',
    description: 'Skema sertifikasi (okupasi / klaster).',
    isSingleton: false,
    fields: [
      { label: 'Title', apiId: 'title', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      { label: 'Short Description', apiId: 'short_description', type: ContentFieldType.TEXT, sortOrder: 1 },
      { label: 'Description', apiId: 'description', type: ContentFieldType.RICH_TEXT, sortOrder: 2 },
      { label: 'Category', apiId: 'category', type: ContentFieldType.TEXT, sortOrder: 3 },
      {
        label: 'Track',
        apiId: 'track',
        type: ContentFieldType.SELECT,
        sortOrder: 4,
        config: {
          options: [
            { label: 'Skema Okupasi', value: 'okupasi' },
            { label: 'Skema Klaster', value: 'klaster' }
          ]
        }
      },
      { label: 'Duration', apiId: 'duration', type: ContentFieldType.TEXT, sortOrder: 5 },
      { label: 'Featured', apiId: 'is_featured', type: ContentFieldType.BOOLEAN, sortOrder: 6 },
      {
        label: 'Target Participants',
        apiId: 'target_participants',
        type: ContentFieldType.JSON,
        description: 'List of strings.',
        sortOrder: 7
      },
      {
        label: 'Competency Scope',
        apiId: 'competency_scope',
        type: ContentFieldType.JSON,
        sortOrder: 8
      },
      {
        label: 'Requirements',
        apiId: 'requirements',
        type: ContentFieldType.JSON,
        sortOrder: 9
      },
      {
        label: 'Required Documents',
        apiId: 'required_documents',
        type: ContentFieldType.JSON,
        sortOrder: 10
      },
      {
        label: 'Assessment Process',
        apiId: 'assessment_process',
        type: ContentFieldType.JSON,
        sortOrder: 11
      }
    ]
  },
  {
    name: 'Certificate Holder',
    apiId: 'certificate_holder',
    description: 'Pemegang sertifikat LSP MICE.',
    isSingleton: false,
    fields: [
      { label: 'Name', apiId: 'name', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      {
        label: 'Registration Number',
        apiId: 'registration_number',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 1
      },
      { label: 'Scheme', apiId: 'scheme', type: ContentFieldType.TEXT, sortOrder: 2 },
      { label: 'Certificate Date', apiId: 'certificate_date', type: ContentFieldType.DATE, sortOrder: 3 },
      { label: 'Valid Until', apiId: 'valid_until', type: ContentFieldType.DATE, sortOrder: 4 },
      { label: 'Year', apiId: 'year', type: ContentFieldType.NUMBER, sortOrder: 5 },
      {
        label: 'Status',
        apiId: 'status',
        type: ContentFieldType.SELECT,
        sortOrder: 6,
        config: {
          options: [
            { label: 'Active', value: 'Active' },
            { label: 'Expired', value: 'Expired' },
            { label: 'Pending Verification', value: 'Pending Verification' }
          ]
        }
      }
    ]
  },
  {
    name: 'News Post',
    apiId: 'news_post',
    description: 'Berita & pengumuman LSP MICE.',
    isSingleton: false,
    fields: [
      { label: 'Title', apiId: 'title', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      { label: 'Excerpt', apiId: 'excerpt', type: ContentFieldType.TEXT, sortOrder: 1 },
      { label: 'Content', apiId: 'content', type: ContentFieldType.RICH_TEXT, sortOrder: 2 },
      { label: 'Cover Image', apiId: 'image', type: ContentFieldType.MEDIA, sortOrder: 3 },
      { label: 'Published Date', apiId: 'published_at', type: ContentFieldType.DATE, sortOrder: 4 },
      { label: 'Display Date', apiId: 'display_date', type: ContentFieldType.TEXT, sortOrder: 5 },
      { label: 'Category', apiId: 'category', type: ContentFieldType.TEXT, sortOrder: 6 },
      { label: 'Featured', apiId: 'is_featured', type: ContentFieldType.BOOLEAN, sortOrder: 7 }
    ]
  },
  {
    name: 'Gallery Album',
    apiId: 'gallery_album',
    description: 'Dokumentasi kegiatan / foto.',
    isSingleton: false,
    fields: [
      { label: 'Title', apiId: 'title', type: ContentFieldType.TEXT, required: true, sortOrder: 0 },
      { label: 'Year', apiId: 'year', type: ContentFieldType.NUMBER, sortOrder: 1 },
      { label: 'Event Date', apiId: 'event_date', type: ContentFieldType.DATE, sortOrder: 2 },
      { label: 'Location', apiId: 'location', type: ContentFieldType.TEXT, sortOrder: 3 },
      { label: 'Caption', apiId: 'caption', type: ContentFieldType.TEXT, sortOrder: 4 },
      { label: 'Cover Image', apiId: 'cover_image', type: ContentFieldType.MEDIA, sortOrder: 5 },
      {
        label: 'Images',
        apiId: 'images',
        type: ContentFieldType.JSON,
        description: 'List of { src, alt, caption }. Migrate to MEDIA list once asset picker supports per-image captions.',
        sortOrder: 6
      }
    ]
  }
]

// ── Singleton data (mirrors lspmice/src/data/*.ts) ─────────────────────────────

const siteSettingsData = {
  name: 'LSP MICE',
  legal_name: 'LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran',
  tagline:
    'Lembaga Sertifikasi Profesi yang mendukung peningkatan kompetensi tenaga kerja di bidang Meeting, Incentive, Convention, and Exhibition.',
  description:
    'Informasi layanan, skema sertifikasi, data pemegang sertifikat, berita, dan dokumentasi kegiatan LSP MICE.',
  navigation: [
    { label: 'Home', href: '/', exact: true },
    { label: 'Tentang Kami', href: '/tentang-kami', matchPrefixes: ['/tentang-kami'] },
    { label: 'Skema Sertifikasi', href: '/skema-sertifikasi', matchPrefixes: ['/skema-sertifikasi'] },
    {
      label: 'Data Pemegang Sertifikat',
      href: '/data-pemegang-sertifikat',
      matchPrefixes: ['/data-pemegang-sertifikat']
    },
    { label: 'Berita', href: '/berita', matchPrefixes: ['/berita'] },
    { label: 'Foto', href: '/foto', matchPrefixes: ['/foto'] },
    { label: 'Kontak', href: '/kontak', matchPrefixes: ['/kontak'] }
  ],
  contact_info: {
    officeName: 'LSP MICE',
    address: 'Gedung Permata Cikini Lt. 2, Jakarta Pusat',
    phone: '(021) 3901216',
    whatsapp: '0856 8444133',
    whatsappIntl: '628568444133',
    contactPerson: 'Prima',
    email: 'info@lspmicepusat.org',
    officeHours: 'Senin - Jumat, 9.00 - 17.00',
    mapPlaceholder:
      'Peta lokasi kantor akan ditampilkan setelah alamat final dan titik lokasi resmi dikonfirmasi.',
    mapsUrl: 'https://maps.app.goo.gl/HfR8nVaAT3ovve2F8'
  },
  contact_action_cards: [
    {
      title: 'Tanya Sertifikasi',
      description:
        'Hubungi tim layanan via WhatsApp untuk menanyakan skema sertifikasi, jadwal pelaksanaan, atau persyaratan awal peserta.',
      href: 'https://wa.me/628568444133?text=Halo%2C%20saya%20ingin%20bertanya%20mengenai%20sertifikasi%20LSP%20MICE.',
      label: 'Chat WhatsApp'
    },
    {
      title: 'Daftar Online',
      description:
        'Kirim pendaftaran melalui email resmi LSP MICE untuk memperoleh arahan awal mengenai proses sertifikasi kompetensi.',
      href: 'mailto:info@lspmicepusat.org?subject=Pendaftaran%20Sertifikasi%20LSP%20MICE',
      label: 'Kirim Email'
    },
    {
      title: 'Lihat Skema Sertifikasi',
      description:
        'Pelajari pilihan skema sertifikasi dan detail kompetensinya sebelum melanjutkan pendaftaran.',
      href: '/skema-sertifikasi',
      label: 'Lihat Skema'
    }
  ]
} satisfies Record<string, unknown>

const heroDescriptionShared =
  'Melalui skema sertifikasi berbasis klaster, LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran mendukung peningkatan kualitas sumber daya manusia yang bekerja di bidang Meeting, Incentive, Convention, and Exhibition.'

const homePageData = {
  hero_slides: [
    {
      image: '/dummy/hero1.jpeg',
      alt: 'Dokumentasi kegiatan sertifikasi profesi bidang MICE',
      eyebrow: 'PENGUATAN SDM MICE',
      title: 'Pengakuan kompetensi',
      accent: 'sesuai standar yang berlaku.',
      description: heroDescriptionShared,
      caption:
        'LSP MICE mendukung peningkatan kompetensi tenaga kerja melalui proses sertifikasi yang profesional, terukur, dan terpercaya.'
    },
    {
      image: '/dummy/hero2.jpeg',
      alt: 'Koordinasi kegiatan layanan dan asesmen kompetensi bidang MICE',
      eyebrow: 'PENGUATAN SDM MICE',
      title: 'Pengakuan kompetensi',
      accent: 'sesuai standar yang berlaku.',
      description: heroDescriptionShared,
      caption:
        'Skema sertifikasi disusun untuk menjawab kebutuhan kompetensi pada berbagai fungsi kerja di bidang MICE.'
    },
    {
      image: '/dummy/hero3.jpeg',
      alt: 'Peserta kegiatan pembekalan kompetensi bidang MICE',
      eyebrow: 'PENGUATAN SDM MICE',
      title: 'Pengakuan kompetensi',
      accent: 'sesuai standar yang berlaku.',
      description: heroDescriptionShared,
      caption:
        'Skema sertifikasi disusun untuk mendukung kebutuhan kompetensi pada berbagai fungsi kerja bidang MICE.'
    }
  ],
  hero: {
    actions: [
      { label: 'Daftar Sekarang', href: '#register-intent', variant: 'primary' },
      { label: 'Lihat Skema Sertifikasi', href: '/skema-sertifikasi', variant: 'secondary' }
    ],
    contactLabel: 'Informasi Kontak',
    hoursLabel: 'Jam Layanan',
    scrollLabel: 'Lihat Profil'
  },
  highlights: [
    {
      title: 'Dalam praktiknya',
      description:
        'Kegiatan MICE membutuhkan tenaga kerja yang mampu mengelola registrasi, komunikasi, logistik, venue, pemasaran, hingga koordinasi teknis acara secara terencana dan bertanggung jawab.'
    },
    {
      title: 'Mengapa butuh sertifikasi MICE?',
      description:
        'Sertifikasi membantu memastikan tenaga kerja MICE memiliki kompetensi yang terukur dan dapat dipertanggungjawabkan. Dengan sertifikasi, pelaku industri memiliki acuan yang lebih jelas terhadap standar kemampuan kerja di bidang MICE.'
    },
    {
      title: 'Apa fungsi LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran?',
      description:
        'LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran berperan dalam menyelenggarakan proses sertifikasi kompetensi, menyiapkan perangkat asesmen, mendukung pelaksanaan uji kompetensi, serta membantu meningkatkan standar profesional tenaga kerja di bidang MICE.'
    }
  ],
  about: {
    eyebrow: 'Apa Itu MICE?',
    title: 'Apa itu MICE?',
    description:
      'Melalui skema sertifikasi berbasis kompetensi yang didukung oleh skema klaster dan okupasi, LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran memvalidasi keahlian SDM secara menyeluruh sesuai profil jabatan sekaligus memberikan fleksibilitas dalam penguasaan unit kompetensi spesifik di industri Meeting, Incentive, Convention, and Exhibition.'
  },
  about_panel: {
    eyebrow: 'Landasan Kerja LSP MICE',
    title: 'Pelaksanaan sertifikasi mengacu pada standar kompetensi kerja yang berlaku.',
    description:
      'Pelaksanaan sertifikasi mengacu pada standar kompetensi kerja dan ketentuan yang berlaku. Detail regulasi, nomor lisensi, dan rujukan hukum resmi perlu dikonfirmasi kembali sebelum publikasi final.',
    points: [
      'Sertifikasi dilaksanakan untuk mendukung peningkatan kompetensi tenaga kerja bidang MICE.',
      'Perangkat asesmen disiapkan sesuai skema sertifikasi dan kebutuhan uji kompetensi.',
      'Informasi resmi mengenai regulasi, lisensi, dan rujukan hukum perlu diverifikasi kembali sebelum publikasi final.'
    ]
  },
  certification: {
    eyebrow: 'Skema Sertifikasi',
    title: 'Skema Sertifikasi Uji Kompetensi',
    accent: 'Berbasis Okupasi & Klaster',
    description:
      'Kami menyediakan skema sertifikasi berbasis okupasi dan klaster agar peserta dapat menyesuaikan uji kompetensi dengan peran jabatan saat ini atau penguasaan fungsi teknis tertentu di bidang pekerjaan masing-masing.',
    ctaLabel: 'Lihat Semua Skema Sertifikasi'
  },
  news: {
    eyebrow: 'Informasi dan Berita',
    title: 'Informasi dan Berita',
    accent: 'dari LSP MICE',
    description:
      'Ikuti informasi terbaru mengenai pendaftaran sertifikasi, kegiatan uji kompetensi, pengumuman layanan, dan agenda terkait pengembangan kompetensi di bidang MICE.',
    featuredEyebrow: 'Informasi Terbaru',
    featuredNote:
      'Ikuti informasi pendaftaran sertifikasi, kegiatan uji kompetensi, pengumuman layanan, dan agenda lain melalui kanal berita LSP MICE.',
    archiveTitle: 'Arsip Berita',
    ctaLabel: 'Baca Berita'
  },
  contact: {
    eyebrow: 'Kontak dan Pendaftaran',
    title: 'Butuh informasi mengenai Sertifikasi MICE?',
    description:
      'Silakan mengajukan pertanyaan seputar sertifikasi dan layanan LSP MICE melalui nomor kantor atau contact person yang tersedia. Staf kami akan membantu menjawab pertanyaan Anda pada jam kerja.',
    actions: [
      { label: 'Hubungi Kami', href: '/kontak', variant: 'accent' },
      { label: 'Daftar Sekarang', href: '#register-intent', variant: 'primary' }
    ],
    infoCards: [
      { label: 'Alamat', value: 'Gedung Permata Cikini Lt. 2, Jakarta Pusat' },
      { label: 'Office', value: '(021) 3901216' },
      { label: 'Admin (WhatsApp)', value: '0856 8444133' },
      { label: 'Office Hours', value: 'Senin - Jumat, 9.00 - 17.00' }
    ]
  }
} satisfies Record<string, unknown>

const aboutPageData = {
  overview_title:
    'Sekilas Tentang LSP MICE Pertemuan Perjalanan Insentif Konvensi dan Pameran',
  overview_paragraphs: [
    'LSP MICE diproyeksikan sebagai rujukan sertifikasi profesi yang membantu industri Meetings, Incentives, Conventions, and Exhibitions menjaga standar kompetensi kerja secara lebih terukur dan kredibel.',
    'Sebagai badan pelaksana sertifikasi profesi yang mandiri, kami berkomitmen untuk terus berinovasi dan bersinergi dengan seluruh pemangku kepentingan dalam mewujudkan tenaga kerja Indonesia yang kompeten dan berdaya saing global.'
  ],
  vision:
    'Menjadi lembaga sertifikasi profesi bidang MICE yang kredibel, modern, dan dipercaya sebagai rujukan pengembangan kompetensi industri.',
  missions: [
    'Menyelenggarakan sertifikasi profesi yang tertib, terukur, dan berorientasi pada mutu layanan.',
    'Mendorong penguatan kompetensi tenaga kerja MICE melalui skema yang relevan dengan kebutuhan industri.',
    'Menyediakan informasi publik yang lebih mudah diakses terkait skema, verifikasi, dan layanan sertifikasi.'
  ],
  functions: [
    'Mengelola pelaksanaan sertifikasi profesi sesuai skema yang telah ditetapkan.',
    'Menyediakan informasi dan layanan awal kepada calon peserta, institusi, dan publik.',
    'Mendukung peningkatan kualitas sumber daya manusia MICE melalui asesmen kompetensi yang terstruktur.',
    'Menjaga dokumentasi layanan, verifikasi data, dan komunikasi kelembagaan secara lebih tertib.'
  ],
  work_foundations: [
    'Penyusunan layanan sertifikasi mengacu pada standar kompetensi yang ditetapkan oleh otoritas terkait.',
    'Pelaksanaan uji kompetensi berpedoman pada pedoman Badan Nasional Sertifikasi Profesi (BNSP).',
    'Penerapan sistem manajemen mutu secara konsisten dan berkelanjutan dalam setiap aspek operasional.'
  ],
  structure_placeholder:
    'Struktur organisasi LSP MICE dirancang secara profesional dengan melibatkan pakar dan praktisi industri yang berpengalaman. Pembaruan bagan resmi organisasi akan ditambahkan pada halaman ini.',
  legal_notes: [
    'Memiliki Lisensi resmi dari Badan Nasional Sertifikasi Profesi (BNSP).',
    'Didukung oleh asosiasi industri terkait bidang MICE.',
    'Beroperasi berdasarkan SK Penetapan dan payung hukum yang berlaku secara nasional.'
  ]
} satisfies Record<string, unknown>

const assessorNames = [
  'Adjat Sudradjat',
  'Heri Seryawan',
  'Aldo Lendy Sumolang',
  'Renno Reymond',
  'Lafiza Fidina',
  'Hanesman Alkhair',
  'Fauzi Mubarak',
  'Andita Pusparani',
  'Muhammad Iqbal Katik',
  'Yosi Erfinda',
  'Syamsurizal'
]

// ── Upsert helpers ─────────────────────────────────────────────────────────────

async function ensureContentType(
  client: PrismaClient,
  siteId: string,
  createdById: string,
  def: ContentTypeDefinition
) {
  return client.contentType.upsert({
    where: { siteId_apiId: { siteId, apiId: def.apiId } },
    update: {
      name: def.name,
      description: def.description,
      isSingleton: def.isSingleton
    },
    create: {
      siteId,
      name: def.name,
      apiId: def.apiId,
      description: def.description,
      isSingleton: def.isSingleton,
      createdById
    }
  })
}

async function ensureContentField(
  client: PrismaClient,
  contentTypeId: string,
  def: FieldDefinition
) {
  return client.contentField.upsert({
    where: { contentTypeId_apiId: { contentTypeId, apiId: def.apiId } },
    update: {
      label: def.label,
      type: def.type,
      description: def.description ?? null,
      required: def.required ?? false,
      isList: def.isList ?? false,
      sortOrder: def.sortOrder,
      config: def.config ?? Prisma.JsonNull
    },
    create: {
      contentTypeId,
      label: def.label,
      apiId: def.apiId,
      type: def.type,
      description: def.description ?? null,
      required: def.required ?? false,
      isList: def.isList ?? false,
      sortOrder: def.sortOrder,
      config: def.config ?? Prisma.JsonNull
    }
  })
}

async function upsertEntry({
  client,
  siteId,
  contentTypeId,
  slug,
  data,
  createdById,
  singleton = false
}: {
  client: PrismaClient
  siteId: string
  contentTypeId: string
  slug: string
  data: Prisma.InputJsonValue
  createdById: string
  singleton?: boolean
}) {
  const existing = await client.contentEntry.findFirst({
    where: singleton ? { contentTypeId } : { contentTypeId, slug },
    select: { id: true, version: true }
  })
  const publishedAt = new Date()
  if (existing) {
    return client.contentEntry.update({
      where: { id: existing.id },
      data: {
        slug,
        status: ContentEntryStatus.PUBLISHED,
        data,
        publishedAt,
        updatedById: createdById,
        version: existing.version + 1
      }
    })
  }
  return client.contentEntry.create({
    data: {
      siteId,
      contentTypeId,
      slug,
      status: ContentEntryStatus.PUBLISHED,
      data,
      version: 1,
      publishedAt,
      createdById,
      updatedById: createdById
    }
  })
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@narah.local'
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin12345!'
  const superAdminPasswordHash = await hashSeedPassword(superAdminPassword)

  const superAdmin = await upsertSeedUser({
    prisma,
    email: superAdminEmail,
    name: 'Super Admin',
    passwordHash: superAdminPasswordHash,
    isSuperAdmin: true
  })

  const activePolicies = await ensureDefaultPolicies(prisma)
  await acceptPoliciesForUser({
    prisma,
    userId: superAdmin.id,
    policyDocumentIds: activePolicies.map((p) => p.id),
    userAgent: 'seed-lspmice-script',
    ipAddress: 'local-seed'
  })

  const site = await prisma.site.upsert({
    where: { slug: SITE_SLUG },
    update: {
      name: SITE_NAME,
      description:
        'Lembaga Sertifikasi Profesi bidang Meeting, Incentive, Convention, and Exhibition.',
      status: SiteStatus.ACTIVE,
      createdById: superAdmin.id
    },
    create: {
      name: SITE_NAME,
      slug: SITE_SLUG,
      description:
        'Lembaga Sertifikasi Profesi bidang Meeting, Incentive, Convention, and Exhibition.',
      status: SiteStatus.ACTIVE,
      createdById: superAdmin.id
    }
  })

  await prisma.siteMember.upsert({
    where: { siteId_userId: { siteId: site.id, userId: superAdmin.id } },
    update: { role: SiteRole.OWNER },
    create: { siteId: site.id, userId: superAdmin.id, role: SiteRole.OWNER }
  })

  const apiIdToContentType = new Map<string, { id: string }>()
  for (const def of contentTypeDefinitions) {
    const ct = await ensureContentType(prisma, site.id, superAdmin.id, def)
    apiIdToContentType.set(def.apiId, ct)
    for (const field of def.fields) {
      await ensureContentField(prisma, ct.id, field)
    }
  }

  // Singletons — slugs use hyphens (entry slug schema rejects underscores).
  await upsertEntry({
    client: prisma,
    siteId: site.id,
    contentTypeId: apiIdToContentType.get('site_settings')!.id,
    slug: 'site-settings',
    data: siteSettingsData,
    createdById: superAdmin.id,
    singleton: true
  })
  await upsertEntry({
    client: prisma,
    siteId: site.id,
    contentTypeId: apiIdToContentType.get('home_page')!.id,
    slug: 'home-page',
    data: homePageData,
    createdById: superAdmin.id,
    singleton: true
  })
  await upsertEntry({
    client: prisma,
    siteId: site.id,
    contentTypeId: apiIdToContentType.get('about_page')!.id,
    slug: 'about-page',
    data: aboutPageData,
    createdById: superAdmin.id,
    singleton: true
  })

  // Assessors
  const assessorTypeId = apiIdToContentType.get('assessor')!.id
  for (let i = 0; i < assessorNames.length; i++) {
    const name = assessorNames[i]
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    await upsertEntry({
      client: prisma,
      siteId: site.id,
      contentTypeId: assessorTypeId,
      slug,
      data: { name, display_order: i + 1 },
      createdById: superAdmin.id
    })
  }

  // API key — only mint if there isn't an active one already, to keep this re-runnable
  // without invalidating a key the website is already using.
  const existingActiveKey = await prisma.apiKey.findFirst({
    where: { siteId: site.id, name: 'lspmice-web', revokedAt: null }
  })

  let mintedKey: { plaintext: string; keyPrefix: string } | null = null
  if (!existingActiveKey) {
    const key = generateApiKey()
    await prisma.apiKey.create({
      data: {
        siteId: site.id,
        name: 'lspmice-web',
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
        scopes: [API_KEY_SCOPES.ENTRIES_READ],
        allowedOrigins: [],
        rateLimitPerMinute: 120,
        createdById: superAdmin.id
      }
    })
    mintedKey = { plaintext: key.plaintext, keyPrefix: key.keyPrefix }
  }

  console.log('')
  console.log('✓ LSPMICE site seeded.')
  console.log(`  Site slug:        ${SITE_SLUG}`)
  console.log(`  Super admin:      ${superAdminEmail} / ${superAdminPassword}`)
  console.log(`  Content types:    ${contentTypeDefinitions.map((c) => c.apiId).join(', ')}`)
  console.log('')
  if (mintedKey) {
    console.log('  New API key created — copy this NOW, it will not be shown again:')
    console.log(`    name:      lspmice-web`)
    console.log(`    prefix:    ${mintedKey.keyPrefix}`)
    console.log(`    plaintext: ${mintedKey.plaintext}`)
  } else {
    console.log(
      `  Active "lspmice-web" API key already exists (prefix=${existingActiveKey!.keyPrefix}); not minting a new one.`
    )
    console.log(`  Revoke it in the admin and re-run the seed to get a fresh key.`)
  }
  console.log('')
  console.log('  Sample public delivery calls (replace BASE_URL + KEY):')
  console.log('    curl -H "x-api-key: $KEY" $BASE_URL/public/v1/me')
  console.log(
    '    curl -H "x-api-key: $KEY" "$BASE_URL/public/v1/content-types/home_page/entries/home-page"'
  )
  console.log(
    '    curl -H "x-api-key: $KEY" "$BASE_URL/public/v1/content-types/assessor/entries"'
  )
}

main()
  .catch((error) => {
    console.error('LSPMICE seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
