import { MenuItem, Table } from '../types/index.ts';

/* =========================================================================================
 * 🌟 GUÍA SUPER FÁCIL PARA EDITAR PLATOS, PRECIOS Y FOTOS (COMO PARA UN NIÑO DE 12 AÑOS):
 * 
 * 🥩 ¿QUÉ ES ESTE ARCHIVO (menuData.ts)?
 * Imagina que este archivo es la gran libreta de cocina del restaurante "El Churo Mosito".
 * Aquí están anotados todos los platos y bebidas deliciosos que vendemos.
 * 
 * 📸 ¿DÓNDE Y CÓMO CAMBIO LA IMAGEN DE CUALQUIER PLATO O BEBIDA?
 * ¡Es muy fácil! Sigue estos 3 pasitos:
 * 1. Busca el plato que quieres cambiar (por ejemplo: POLLO A LA LEÑA).
 * 2. Busca la línea que dice:
 *       image: 'https://images.unsplash.com/...'
 * 3. Borra el link viejo entre las comillas simples ' ' y pega el link de tu foto nueva.
 *    ¡Y listo! Se verá automáticamente en el celular y computadora de todos los clientes.
 * 
 * 💰 ¿CÓMO CAMBIO EL PRECIO EN BOLIVIANOS?
 * 1. Busca la línea que dice:
 *       precioBs: 35,
 * 2. Cambia el número 35 por el nuevo precio (por ejemplo: 40).
 * 
 * 🏷️ ¿QUÉ SIGNIFICA CADA DATO DE UN PLATO?
 * - id: Es como el número de carnet o DNI del plato (debe ser único, ej: "pc-1").
 * - categoria: La sección del menú donde aparece (ej: "PARRILLA Y CRUZ", "SOPAS", "JUGOS").
 * - nombre: El nombre rico del plato en letras mayúsculas.
 * - descripcion: Qué ingredientes trae (papa, ensalada, arroz, etc.).
 * - precioBs: Cuántos Bolivianos cuesta pagar este plato.
 * - disponible: Si es 'true' hay comida disponible. Si es 'false', saldrá como "Agotado".
 * - image: La foto del plato. ¡Pega aquí tu foto favorita!
 * - prepTime: Cuántos minutos tarda el cocinero en prepararlo (ej: "20 min").
 * - spicy: Nivel de picante del 0 al 3 (0 = sin picante, 1 = suave, 2 = medio, 3 = muy picante).
 * ========================================================================================= */

export const MENU_CATEGORIAS: string[] = [
  "PARRILLA Y CRUZ",
  "CORTES A LA PARRILLA",
  "MENU CRIOLLO",
  "SOPAS",
  "GUARNICIONES",
  "EXTRAS",
  "POSTRES",
  "JUGOS DE LA CASA",
  "COCTELES",
  "BEBIDAS GASEOSAS Y AGUA",
  "VINOS DE LA CASA"
];

export const INITIAL_MENU: MenuItem[] = [
  // -------------------------------------------------------------
  // SECCIÓN 1: PARRILLA Y CRUZ (Carnes asadas y platos a la leña)
  // -------------------------------------------------------------
  {
    id: "pc-1",
    categoria: "PARRILLA Y CRUZ",
    nombre: "POLLO A LA LEÑA",
    descripcion: "Acompañado con arroz graneado, papa, oca, yuca y camote.",
    precioBs: 35, // 💰 Cambia aquí el precio en Bolivianos
    disponible: true,
    // 📸 FOTO DEL POLLO: Cambia el link entre comillas para poner tu propia foto:
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "pc-2",
    categoria: "PARRILLA Y CRUZ",
    nombre: "PACÚ O SÁBALO A LA LEÑA O PARRILLA",
    descripcion: "Pescado a la leña o parrilla.",
    notas: "20 a 30 min. de preparación",
    precioBs: 64,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    prepTime: '25 min',
    spicy: 0
  },
  {
    id: "pc-3",
    categoria: "PARRILLA Y CRUZ",
    nombre: "COSTILLAR A LA CRUZ",
    descripcion: "Tradicional costillar asado a la cruz.",
    precioBs: 70,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 1
  },
  {
    id: "pc-4",
    categoria: "PARRILLA Y CRUZ",
    nombre: "LECHON A LA CRUZ",
    descripcion: "Jugoso lechón con cuero crujiente a la cruz.",
    precioBs: 70,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 1
  },
  {
    id: "pc-5",
    categoria: "PARRILLA Y CRUZ",
    nombre: "MIXTO",
    descripcion: "Combinación de lechón y costillar a la cruz. Acompañado con choclo, mote, papa, oca, yuca y deliciosos camotes morados.",
    notas: "Para 2 personas",
    precioBs: 140,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 1
  },
  {
    id: "pc-6",
    categoria: "PARRILLA Y CRUZ",
    nombre: "GARRONES DE LECHÓN",
    descripcion: "Porción de 4 unidades de tiernos garrones de lechón.",
    notas: "4 UNIDADES",
    precioBs: 20,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 0
  },
  {
    id: "pc-7",
    categoria: "PARRILLA Y CRUZ",
    nombre: "CABEZA DE LECHÓN",
    descripcion: "Deliciosa y crujiente cabeza de lechón asada.",
    precioBs: 50,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "pc-8",
    categoria: "PARRILLA Y CRUZ",
    nombre: "PARRILLITA DE LECHÓN O COSTILLAR",
    descripcion: "Parrillita especial de lechón o costillar.",
    notas: "Para 2 personas y sólo de lunes a viernes",
    precioBs: 140,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 1
  },
  {
    id: "pc-9",
    categoria: "PARRILLA Y CRUZ",
    nombre: "PARRILLITA MIXTA (LECHÓN Y COSTILLAR)",
    descripcion: "Combinación de lechón y costillar a la parrilla.",
    notas: "Para 2 personas y sólo de lunes a viernes",
    precioBs: 160,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 1
  },
  {
    id: "pc-10",
    categoria: "PARRILLA Y CRUZ",
    nombre: "PARRILLITA TRI MIXTA (LECHÓN, COSTILLAR, POLLO)",
    descripcion: "Variedad de carnes a la parrilla.",
    notas: "Para 3 personas y sólo de lunes a viernes",
    precioBs: 180,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '25 min',
    spicy: 1
  },

  // CORTES A LA PARRILLA
  {
    id: "cp-1",
    categoria: "CORTES A LA PARRILLA",
    nombre: "LA MOSITA",
    descripcion: "Bife de chorizo, tira de asado, jiba y ubre o entraña.",
    notas: "4 cortes a elección, para 3 personas",
    precioBs: 199,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '25 min',
    spicy: 0
  },
  {
    id: "cp-2",
    categoria: "CORTES A LA PARRILLA",
    nombre: "BIFE DE CHORIZO",
    descripcion: "Corte selecto y jugoso a la parrilla.",
    notas: "350 GR.",
    precioBs: 69,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "cp-3",
    categoria: "CORTES A LA PARRILLA",
    nombre: "TIRA DE ASADO",
    descripcion: "Clásica tira de asado tierno y jugoso.",
    notas: "350 GR.",
    precioBs: 69,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "cp-4",
    categoria: "CORTES A LA PARRILLA",
    nombre: "JIBA",
    descripcion: "Corte tierno de jiba vacuna.",
    notas: "350 GR.",
    precioBs: 69,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "cp-5",
    categoria: "CORTES A LA PARRILLA",
    nombre: "MATAMBRE DE CERDO",
    descripcion: "Suave matambre de cerdo a la parrilla.",
    notas: "350 GR.",
    precioBs: 66,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "cp-6",
    categoria: "CORTES A LA PARRILLA",
    nombre: "ENTRAÑA",
    descripcion: "Exquisita entraña fina a la parrilla.",
    notas: "300 GR.",
    precioBs: 69,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 0
  },
  {
    id: "cp-7",
    categoria: "CORTES A LA PARRILLA",
    nombre: "UBRE",
    descripcion: "Tierna ubre dorada a la parrilla.",
    notas: "250 GR.",
    precioBs: 49,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 0
  },
  {
    id: "cp-8",
    categoria: "CORTES A LA PARRILLA",
    nombre: "CHORI DE LA CASA",
    descripcion: "Chorizo artesanal especial.",
    notas: "Sólo la porción",
    precioBs: 15,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 0
  },

  // MENU CRIOLLO
  {
    id: "mc-1",
    categoria: "MENU CRIOLLO",
    nombre: "PLATO CRIOLLO",
    descripcion: "Combinación de nuestra deliciosa especialidad criolla: Saice, Ranga y Picante Mixto Criollo, chancho a la olla o costillitas a la olla.",
    notas: "Para 2 personas",
    precioBs: 126,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 3
  },
  {
    id: "mc-2",
    categoria: "MENU CRIOLLO",
    nombre: "DUO CRIOLLO",
    descripcion: "Combinación de la elección de dos platos del menú criollo.",
    precioBs: 46,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 2
  },
  {
    id: "mc-3",
    categoria: "MENU CRIOLLO",
    nombre: "COSTILLITAS A LA OLLA O CHANCHO A LA OLLA",
    descripcion: "Trocitos de carne cocinados a fuego lento con especias tradicionales.",
    precioBs: 56,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 1
  },
  {
    id: "mc-4",
    categoria: "MENU CRIOLLO",
    nombre: "CHANCAO CRIOLLO",
    descripcion: "Tradicional chancao de pollo con sabor casero.",
    precioBs: 36,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 2
  },
  {
    id: "mc-5",
    categoria: "MENU CRIOLLO",
    nombre: "PICANTE DE LENGUA",
    descripcion: "Tierna lengua de res en salsa picante tradicional.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 3
  },
  {
    id: "mc-6",
    categoria: "MENU CRIOLLO",
    nombre: "PICANTE CRIOLLO",
    descripcion: "Picante tradicional con sazón criolla.",
    precioBs: 29,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 3
  },
  {
    id: "mc-7",
    categoria: "MENU CRIOLLO",
    nombre: "SAICE",
    descripcion: "Tradicional guiso de carne picada con arvejas, papa y fideo.",
    precioBs: 22,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 2
  },
  {
    id: "mc-8",
    categoria: "MENU CRIOLLO",
    nombre: "RANGA",
    descripcion: "Estofado picante de panza de res cocinada a fuego lento.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    prepTime: '12 min',
    spicy: 3
  },

  // SOPAS
  {
    id: "sop-1",
    categoria: "SOPAS",
    nombre: "SOPA DE GALLINA CRIOLLA (ARROZ) COMPLETA",
    descripcion: "Sopa reconfortante de gallina criolla con arroz y presa.",
    precioBs: 19,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    prepTime: '8 min',
    spicy: 0
  },
  {
    id: "sop-2",
    categoria: "SOPAS",
    nombre: "SOPA DE GALLINA CRIOLLA (ARROZ) SENCILLA",
    descripcion: "Consomé nutritivo de gallina criolla.",
    precioBs: 11,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    prepTime: '8 min',
    spicy: 0
  },
  {
    id: "sop-3",
    categoria: "SOPAS",
    nombre: "SOPA DE MANÍ COMPLETA",
    descripcion: "Tradicional sopa de maní con guarniciones y carne.",
    precioBs: 19,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 1
  },
  {
    id: "sop-4",
    categoria: "SOPAS",
    nombre: "SOPA DE MANÍ SENCILLA",
    descripcion: "Deliciosa sopa cremosa de maní.",
    precioBs: 11,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 1
  },

  // GUARNICIONES
  {
    id: "guar-1",
    categoria: "GUARNICIONES",
    nombre: "PAPAS FRITAS RÚSTICAS",
    descripcion: "Papas doradas y crujientes con corte rústico.",
    precioBs: 11,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 0
  },
  {
    id: "guar-2",
    categoria: "GUARNICIONES",
    nombre: "YUCA FRITA",
    descripcion: "Yucas doradas crujientes por fuera y suaves por dentro.",
    precioBs: 15,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 0
  },
  {
    id: "guar-3",
    categoria: "GUARNICIONES",
    nombre: "GUARNICION DE LECHÓN O COSTILLAR COMPLETA",
    descripcion: "Acompañamiento completo tradicional.",
    precioBs: 16,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    prepTime: '10 min',
    spicy: 0
  },
  {
    id: "guar-4",
    categoria: "GUARNICIONES",
    nombre: "PORCIÓN DE ARROZ",
    descripcion: "Arroz graneado.",
    precioBs: 5,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },

  // EXTRAS
  {
    id: "ext-1",
    categoria: "EXTRAS",
    nombre: "PIQUE MACHO",
    descripcion: "Trocitos de carne, salchicha, locoto, papas fritas y huevo.",
    precioBs: 60,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    prepTime: '20 min',
    spicy: 3
  },
  {
    id: "ext-2",
    categoria: "EXTRAS",
    nombre: "LOMO MONTADO",
    descripcion: "Bife de lomo con huevo frito, arroz y papas.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 0
  },
  {
    id: "ext-3",
    categoria: "EXTRAS",
    nombre: "MILANESA",
    descripcion: "Milanesa crujiente con guarnición.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    prepTime: '15 min',
    spicy: 0
  },

  // POSTRES
  {
    id: "pos-1",
    categoria: "POSTRES",
    nombre: "LEMON PAY",
    descripcion: "Clásico pastel de limón con merengue.",
    precioBs: 18,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "pos-2",
    categoria: "POSTRES",
    nombre: "FLAN",
    descripcion: "Flan casero de vainilla con caramelo.",
    precioBs: 10,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1527784383607-3f614ebe670a?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "pos-3",
    categoria: "POSTRES",
    nombre: "GELATINA PRIMAVERA",
    descripcion: "Postre de gelatina multicolor.",
    precioBs: 12,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },

  // JUGOS DE LA CASA
  {
    id: "jug-1",
    categoria: "JUGOS DE LA CASA",
    nombre: "FRUTILLA",
    descripcion: "Jugo natural de frutilla fresca.",
    precioBs: 19,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "jug-2",
    categoria: "JUGOS DE LA CASA",
    nombre: "LINAZA",
    descripcion: "Refrescante linaza natural.",
    precioBs: 13,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "jug-3",
    categoria: "JUGOS DE LA CASA",
    nombre: "LIMONDA",
    descripcion: "Limonada fresca de la casa.",
    precioBs: 13,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "jug-4",
    categoria: "JUGOS DE LA CASA",
    nombre: "MOCOCHINCHE",
    descripcion: "Refresco tradicional de durazno deshidratado.",
    precioBs: 13, // 💰 Precio en Bolivianos
    disponible: true,
    // 📸 FOTO DEL MOCOCHINCHE: Pega aquí la foto de tu refresco:
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },

  // =============================================================
  // 🍸 SECCIÓN: COCTELES Y TRAGOS
  // 💡 Para cambiar la foto de un coctel: cambia el link en `image: '...'`
  // 💡 Para cambiar el precio: cambia el número en `precioBs: ...`
  // =============================================================
  {
    id: "coc-1",
    categoria: "COCTELES",
    nombre: "MARGARITA CORONA",
    descripcion: "Margarita especial con cerveza Corona.",
    precioBs: 36,
    disponible: true,
    // 📸 FOTO DEL COCTEL:
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-2",
    categoria: "COCTELES",
    nombre: "FRUTOS ROJOS",
    descripcion: "Coctel con frutos rojos y licor.",
    precioBs: 33,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-3",
    categoria: "COCTELES",
    nombre: "PIÑA COLADA",
    descripcion: "Clásico coctel tropical con piña y coco.",
    precioBs: 26,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-4",
    categoria: "COCTELES",
    nombre: "MOJITO",
    descripcion: "Mojito tradicional con hierbabuena y limón.",
    precioBs: 23,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-5",
    categoria: "COCTELES",
    nombre: "CARPIRIÑA",
    descripcion: "Coctel brasileño con cachaça y limón.",
    precioBs: 23,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-6",
    categoria: "COCTELES",
    nombre: "CHUSLAY",
    descripcion: "Coctel tradicional de la región.",
    precioBs: 19,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },
  {
    id: "coc-7",
    categoria: "COCTELES",
    nombre: "SAN MATEO",
    descripcion: "Coctel especial de la casa.",
    precioBs: 16,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    prepTime: '5 min',
    spicy: 0
  },

  // BEBIDAS GASEOSAS Y AGUA
  {
    id: "beb-1",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "AGUA VITAL 2 L",
    descripcion: "Botella de agua mineral de 2 litros.",
    precioBs: 13,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-2",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "AGUA VITAL 600 Ml",
    descripcion: "Botella personal de agua mineral.",
    precioBs: 8,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-3",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "AGUA CON GAS 620 Ml",
    descripcion: "Agua mineral con gas.",
    precioBs: 9,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-4",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "TERRUÑO TINTO",
    descripcion: "Bebida refrescante Terruño tinto.",
    precioBs: 39,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-5",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "TERRUÑO BLANCO",
    descripcion: "Bebida refrescante Terruño blanco.",
    precioBs: 37,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-6",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "ARANJUEZ COMÚN",
    descripcion: "Bebida de la casa Aranjuez.",
    precioBs: 29,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-7",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "POTOSINA YAPADITA",
    descripcion: "Cerveza tradicional de Potosí.",
    precioBs: 39,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1608270154020-f5383a152d49?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-8",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "HUARI 620 ML",
    descripcion: "Cerveza boliviana premium Huari.",
    precioBs: 33,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1608270154020-f5383a152d49?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-9",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "PACEÑA",
    descripcion: "Cerveza tradicional Paceña.",
    precioBs: 36,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1608270154020-f5383a152d49?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-10",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "CORONA 330ML",
    descripcion: "Cerveza importada Corona.",
    precioBs: 22,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1608270154020-f5383a152d49?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },
  {
    id: "beb-11",
    categoria: "BEBIDAS GASEOSAS Y AGUA",
    nombre: "CERVEZA ARTESANAL CHURO MOSITO DE 1 L",
    descripcion: "Cerveza artesanal de la casa de 1 litro.",
    precioBs: 37,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1608270154020-f5383a152d49?auto=format&fit=crop&w=600&q=80',
    prepTime: '2 min',
    spicy: 0
  },

  // VINOS DE LA CASA
  {
    id: "vin-1",
    categoria: "VINOS DE LA CASA",
    nombre: "TANNAT",
    descripcion: "Exquisito vino de altura Tannat.",
    precioBs: 89,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-2",
    categoria: "VINOS DE LA CASA",
    nombre: "SEMI DULCE TINTO",
    descripcion: "Vino tinto semi dulce de la casa.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-3",
    categoria: "VINOS DE LA CASA",
    nombre: "ROSE QUITA CALZÓN DE LOS MOSITOS",
    descripcion: "Especial vino rosé de la casa.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-4",
    categoria: "VINOS DE LA CASA",
    nombre: "BLUE",
    descripcion: "Vino especial Blue.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-5",
    categoria: "VINOS DE LA CASA",
    nombre: "SECO BLANCO",
    descripcion: "Vino blanco seco de altura.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-6",
    categoria: "VINOS DE LA CASA",
    nombre: "SEMIDULCE BLANCO",
    descripcion: "Vino blanco semidulce.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-7",
    categoria: "VINOS DE LA CASA",
    nombre: "TINTO SECO",
    descripcion: "Vino tinto seco tradicional.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  },
  {
    id: "vin-8",
    categoria: "VINOS DE LA CASA",
    nombre: "CHOCOLATE SEMI DULCE",
    descripcion: "Vino con notas de chocolate semi dulce.",
    precioBs: 35,
    disponible: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
    prepTime: '3 min',
    spicy: 0
  }
];

export const INITIAL_TABLES: Table[] = [
  { id: 1, name: 'Mesa 1 - Terraza Principal', seats: 4, status: 'free', currentOrder: null },
  { id: 2, name: 'Mesa 2 - Terraza Vista', seats: 2, status: 'free', currentOrder: null },
  { id: 3, name: 'Mesa 3 - Salón Central', seats: 6, status: 'free', currentOrder: null },
  { id: 4, name: 'Mesa 4 - Salón Central', seats: 4, status: 'free', currentOrder: null },
  { id: 5, name: 'Mesa 5 - VIP Bodega', seats: 8, status: 'free', currentOrder: null },
  { id: 6, name: 'Mesa 6 - Patio Colonial', seats: 4, status: 'free', currentOrder: null },
  { id: 7, name: 'Mesa 7 - Terraza Lateral', seats: 4, status: 'free', currentOrder: null },
  { id: 8, name: 'Mesa 8 - Terraza Lateral', seats: 4, status: 'free', currentOrder: null },
  { id: 9, name: 'Mesa 9 - Salón Interior', seats: 2, status: 'free', currentOrder: null },
  { id: 10, name: 'Mesa 10 - Salón Interior', seats: 2, status: 'free', currentOrder: null },
  { id: 11, name: 'Mesa 11 - Salón Interior', seats: 4, status: 'free', currentOrder: null },
  { id: 12, name: 'Mesa 12 - Salón Interior', seats: 6, status: 'free', currentOrder: null },
];

/**
 * 🏷️ Formatea el texto de la mesa en los comboboxes/selectores de manera limpia,
 * evitando duplicaciones como "Mesa #12 - Mesa 12 - Salón Interior".
 */
export const formatTableOptionLabel = (t: { id: number; name?: string }): string => {
  if (!t) return '';
  let name = (t.name || '').trim();
  if (!name) return `Mesa #${t.id}`;

  // Elimina repeticiones duplicadas accidentales como "Mesa #12 - Mesa 12" o "Mesa 12 - Mesa 12"
  name = name.replace(/^mesa\s*#?\d+\s*[-–—]\s*(mesa\s*#?\d+)/i, '$1');

  // Si ya comienza con "Mesa" (ej: "Mesa 12 - Salón Interior"), la mostramos directamente
  if (/^mesa\b/i.test(name)) {
    return name;
  }

  // Si sólo tiene el sector o nombre personalizado (ej: "Salón VIP"), agregamos "Mesa #X - "
  return `Mesa #${t.id} - ${name}`;
};
