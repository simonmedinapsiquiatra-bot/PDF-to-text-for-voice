// Reglas léxicas y bibliográficas: detección de idioma, expansión de siglas,
// omisión de referencias/colaboradores y detección de títulos de portada.
import { L } from './charClasses.ts';

export function autodetectarLenguaje(texto) {
  if (!texto) return 'es';
  const cleanText = texto.toLowerCase();
  
  const palabrasES = [' el ', ' de ', ' la ', ' que ', ' en ', ' los ', ' las ', ' un ', ' una ', ' con ', ' para ', ' por ', ' esta ', ' como ', ' es ', ' y '];
  const palabrasEN = [' the ', ' of ', ' and ', ' to ', ' in ', ' that ', ' is ', ' was ', ' for ', ' on ', ' with ', ' as ', ' by ', ' this ', ' it ', ' a '];
  
  let countES = 0;
  let countEN = 0;
  
  for (const w of palabrasES) {
    const matches = cleanText.match(new RegExp(w, 'g'));
    if (matches) countES += matches.length;
  }
  
  for (const w of palabrasEN) {
    const matches = cleanText.match(new RegExp(w, 'g'));
    if (matches) countEN += matches.length;
  }
  
  return countES >= countEN ? 'es' : 'en';
}
export function expandirSiglasPsiquiatria(texto, lang) {
  if (!texto) return "";
  let res = texto;
  
  if (lang === 'es') {
    const siglasES = [
      // Plurales primero para evitar que coincida la raíz singular
      { re: /\bTCAs\b/g, rep: "trastornos de la conducta alimentaria" },
      { re: /\btcas\b/g, rep: "trastornos de la conducta alimentaria" },
      { re: /\bTCA\b/g, rep: "trastorno de la conducta alimentaria" },
      { re: /\btca\b/g, rep: "trastorno de la conducta alimentaria" },
      
      { re: /\bAN\b/g, rep: "anorexia nerviosa" },
      { re: /\bBN\b/g, rep: "bulimia nerviosa" },
      
      { re: /\bTOCs\b/g, rep: "trastornos obsesivo compulsivos" },
      { re: /\bTOC\b/g, rep: "trastorno obsesivo compulsivo" },
      
      { re: /\bTAG\b/g, rep: "trastorno de ansiedad generalizada" },
      
      { re: /\bTDAH\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
      { re: /\btdah\b/g, rep: "trastorno por déficit de atención e hiperactividad" },
      
      { re: /\bTEA\b/g, rep: "trastorno del espectro autista" }, // Solo mayúsculas para evitar 'tea' (infusión)
      { re: /\bTLP\b/g, rep: "trastorno límite de la personalidad" },
      { re: /\btlp\b/g, rep: "trastorno límite de la personalidad" },
      
      { re: /\bTAB\b/g, rep: "trastorno afectivo bipolar" },
      
      { re: /\bTA\b/g, rep: "trastorno por atracón" }, // Solo mayúsculas para evitar 'ta' coloquial
      
      { re: /\bISRS\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" },
      { re: /\bisrs\b/g, rep: "inhibidores selectivos de la recaptación de serotonina" },
      { re: /\bIRSN\b/g, rep: "inhibidores de la recaptación de serotonina y noradrenalina" },
      { re: /\birsn\b/g, rep: "inhibidores de la recaptación de serotonina y noradrenalina" },
      
      { re: /\bIMC\b/g, rep: "índice de masa corporal" },
      { re: /\bimc\b/g, rep: "índice de masa corporal" },
      
      { re: /\bAPA\b/g, rep: "Asociación Psiquiátrica Americana" },
      { re: /\bVO\b/g, rep: "vía oral" },
      
      // --- Nuevas siglas incorporadas desde la carpeta Papers ---
      { re: /\bTEPT-C\b/g, rep: "trastorno de estrés postraumático complejo" },
      { re: /\btept-c\b/g, rep: "trastorno de estrés postraumático complejo" },
      { re: /\bTEPT\b/g, rep: "trastorno de estrés postraumático" },
      { re: /\btept\b/g, rep: "trastorno de estrés postraumático" },
      { re: /\bTPET\b/g, rep: "trastorno de estrés postraumático" }, // Variante por error común
      { re: /\btpet\b/g, rep: "trastorno de estrés postraumático" },
      
      { re: /\bTDM\b/g, rep: "trastorno depresivo mayor" },
      { re: /\btdm\b/g, rep: "trastorno depresivo mayor" },
      
      { re: /\bTUS\b/g, rep: "trastorno por uso de sustancias" },
      
      { re: /\bTID\b/g, rep: "trastorno de identidad disociativo" },
      { re: /\btid\b/g, rep: "trastorno de identidad disociativo" },
      
      { re: /\bTDC\b/g, rep: "trastorno dismórfico corporal" },
      { re: /\btdc\b/g, rep: "trastorno dismórfico corporal" },
      
      { re: /\bTEC\b/g, rep: "terapia electroconvulsiva" },
      { re: /\btec\b/g, rep: "terapia electroconvulsiva" },
      
      { re: /\bTCC\b/g, rep: "terapia cognitivo conductual" },
      { re: /\btcc\b/g, rep: "terapia cognitivo conductual" },
      
      { re: /\bEMDR\b/g, rep: "desensibilización y reprocesamiento por movimientos oculares" },
      { re: /\bemdr\b/g, rep: "desensibilización y reprocesamiento por movimientos oculares" },
      
      { re: /\bEMTr\b/g, rep: "estimulación magnética transcraneal repetitiva" },
      { re: /\bemtr\b/g, rep: "estimulación magnética transcraneal repetitiva" },
      
      { re: /\bPANSS\b/g, rep: "escala de los síndromes positivo y negativo" },
      { re: /\bpanss\b/g, rep: "escala de los síndromes positivo y negativo" },
      
      { re: /\bTPs\b/g, rep: "trastornos de la personalidad" },
      { re: /\btps\b/g, rep: "trastornos de la personalidad" },
      { re: /\bTP\b/g, rep: "trastorno de la personalidad" }, // Solo mayúsculas para evitar 'tp'
      
      // Números Romanos (Ordinales I-X, Cardinales XI-XXX con salvaguardas para iniciales de nombres)
      { re: /\bXXX\b/g, rep: "treinta" },
      { re: /\bXXIX\b/g, rep: "veintinueve" },
      { re: /\bXXVIII\b/g, rep: "veintiocho" },
      { re: /\bXXVII\b/g, rep: "veintisiete" },
      { re: /\bXXVI\b/g, rep: "veintiséis" },
      { re: /\bXXV\b/g, rep: "veinticinco" },
      { re: /\bXXIV\b/g, rep: "veinticuatro" },
      { re: /\bXXIII\b/g, rep: "veintitrés" },
      { re: /\bXXII\b/g, rep: "veintidós" },
      { re: /\bXXI\b/g, rep: "veintiuno" },
      { re: /\bXX\b/g, rep: "veinte" },
      { re: /\bXIX\b/g, rep: "diecinueve" },
      { re: /\bXVIII\b/g, rep: "dieciocho" },
      { re: /\bXVII\b/g, rep: "diecisiete" },
      { re: /\bXVI\b/g, rep: "dieciséis" },
      { re: /\bXV\b/g, rep: "quince" },
      { re: /\bXIV\b/g, rep: "catorce" },
      { re: /\bXIII\b/g, rep: "trece" },
      { re: /\bXII\b/g, rep: "doce" },
      { re: /\bXI\b/g, rep: "once" },
      { re: /\bX\b/g, rep: "décimo" },
      { re: /\bIX\b/g, rep: "noveno" },
      { re: /\bVIII\b/g, rep: "octavo" },
      { re: /\bVII\b/g, rep: "séptimo" },
      { re: /\bVI\b/g, rep: "sexto" },
      { re: /(?<![A-Z]\.\s+)\bV\b(?!\.\s*[A-Z]\.)/g, rep: "quinto" },
      { re: /\bIV\b/g, rep: "cuarto" },
      { re: /\bIII\b/g, rep: "tercero" },
      { re: /\bII\b/g, rep: "segundo" },
      { re: /(?<![A-Z]\.\s+)\bI\b(?!\.\s*[A-Z]\.)/g, rep: "primero" },
      
      // Elementos temporales e históricos
      { re: /\ba\.\s*de\s*c\./gi, rep: "antes de cristo" },
      { re: /\ba\.\s*c\./gi, rep: "antes de cristo" },
      { re: /\bd\.\s*de\s*c\./gi, rep: "después de cristo" },
      { re: /\bd\.\s*c\./gi, rep: "después de cristo" },
      
      // Unidades de medida (con o sin número previo, ej: 10mg o 10 mg)
      { re: /\b(\d+)\s*mg\b/gi, rep: "$1 miligramos" },
      { re: /\b(\d+)\s*ml\b/gi, rep: "$1 mililitros" },
      { re: /\b(\d+)\s*kg\b/gi, rep: "$1 kilogramos" },
      { re: /\b(\d+)\s*mcg\b/gi, rep: "$1 microgramos" },
      { re: /\b(\d+)\s*μg\b/g, rep: "$1 microgramos" },
      { re: /\b(\d+)\s*g\b/gi, rep: "$1 gramos" }, // Solo gramos con número previo
      
      { re: /\bmg\b/gi, rep: "miligramos" },
      { re: /\bml\b/gi, rep: "mililitros" },
      { re: /\bmcg\b/gi, rep: "microgramos" }
    ];
    
    for (const rule of siglasES) {
      res = res.replace(rule.re, rule.rep);
    }
  } 
  else if (lang === 'en') {
    const siglasEN = [
      { re: /\bTCAs\b/g, rep: "tricyclic antidepressants" },
      { re: /\btcas\b/g, rep: "tricyclic antidepressants" },
      { re: /\bTCA\b/g, rep: "tricyclic antidepressant" },
      { re: /\btca\b/g, rep: "tricyclic antidepressant" },
      
      { re: /\bEDs\b/g, rep: "eating disorders" },
      { re: /\bED\b/g, rep: "eating disorder" }, // Solo mayúsculas para evitar 'ed' (nombre propio)
      
      { re: /\bAN\b/g, rep: "anorexia nervosa" },
      { re: /\bBN\b/g, rep: "bulimia nervosa" },
      { re: /\bBED\b/g, rep: "binge eating disorder" }, // Solo mayúsculas para evitar 'bed' (cama)
      
      { re: /\bOCD\b/g, rep: "obsessive-compulsive disorder" },
      { re: /\bocd\b/g, rep: "obsessive-compulsive disorder" },
      
      { re: /\bGAD\b/g, rep: "generalized anxiety disorder" },
      { re: /\bgad\b/g, rep: "generalized anxiety disorder" },
      
      { re: /\bADHD\b/g, rep: "attention-deficit hyperactivity disorder" },
      { re: /\badhd\b/g, rep: "attention-deficit hyperactivity disorder" },
      
      { re: /\bASD\b/g, rep: "autism spectrum disorder" },
      { re: /\basd\b/g, rep: "autism spectrum disorder" },
      
      { re: /\bBPD\b/g, rep: "borderline personality disorder" },
      { re: /\bbpd\b/g, rep: "borderline personality disorder" },
      
      { re: /\bMDD\b/g, rep: "major depressive disorder" },
      { re: /\bmdd\b/g, rep: "major depressive disorder" },
      
      { re: /\bCBT-E\b/g, rep: "enhanced cognitive behavioral therapy" },
      { re: /\bcbt-e\b/g, rep: "enhanced cognitive behavioral therapy" },
      { re: /\bCBT\b/g, rep: "cognitive behavioral therapy" },
      { re: /\bcbt\b/g, rep: "cognitive behavioral therapy" },
      
      { re: /\bIPT\b/g, rep: "interpersonal psychotherapy" },
      { re: /\bipt\b/g, rep: "interpersonal psychotherapy" },
      
      { re: /\bSSRIs\b/g, rep: "selective serotonin reuptake inhibitors" },
      { re: /\bssris\b/g, rep: "selective serotonin reuptake inhibitors" },
      { re: /\bSSRI\b/g, rep: "selective serotonin reuptake inhibitor" },
      { re: /\bssri\b/g, rep: "selective serotonin reuptake inhibitor" },
      
      { re: /\bSNRIs\b/g, rep: "serotonin-norepinephrine reuptake inhibitors" },
      { re: /\bsnris\b/g, rep: "serotonin-norepinephrine reuptake inhibitors" },
      { re: /\bSNRI\b/g, rep: "serotonin-norepinephrine reuptake inhibitor" },
      { re: /\bsnri\b/g, rep: "serotonin-norepinephrine reuptake inhibitor" },
      
      { re: /\bBMI\b/g, rep: "body mass index" },
      { re: /\bbmi\b/g, rep: "body mass index" },
      
      { re: /\bAPA\b/g, rep: "American Psychiatric Association" },
      
      // --- Nuevas siglas incorporadas desde la carpeta Papers ---
      { re: /\bCPTSD\b/g, rep: "complex post-traumatic stress disorder" },
      { re: /\bcptsd\b/g, rep: "complex post-traumatic stress disorder" },
      { re: /\bPTSD\b/g, rep: "post-traumatic stress disorder" },
      { re: /\bptsd\b/g, rep: "post-traumatic stress disorder" },
      
      { re: /\bSUDs\b/g, rep: "substance use disorders" },
      { re: /\bsuds\b/g, rep: "substance use disorders" },
      { re: /\bSUD\b/g, rep: "substance use disorder" }, // Solo mayúsculas
      
      { re: /\bDID\b/g, rep: "dissociative identity disorder" },
      
      { re: /\bDPD\b/g, rep: "depersonalization-derealization disorder" },
      { re: /\bdpd\b/g, rep: "depersonalization-derealization disorder" },
      
      { re: /\bBDD\b/g, rep: "body dysmorphic disorder" },
      { re: /\bbdd\b/g, rep: "body dysmorphic disorder" },
      
      { re: /\bSZ\b/g, rep: "schizophrenia" }, // Solo mayúsculas para evitar 'sz' (letra/abreviación)
      { re: /\bSCZ\b/g, rep: "schizophrenia" },
      { re: /\bscz\b/g, rep: "schizophrenia" },
      
      { re: /\bECT\b/g, rep: "electroconvulsive therapy" },
      { re: /\bect\b/g, rep: "electroconvulsive therapy" },
      
      { re: /\bEMDR\b/g, rep: "eye movement desensitization and reprocessing" },
      { re: /\bemdr\b/g, rep: "eye movement desensitization and reprocessing" },
      
      { re: /\brTMS\b/g, rep: "repetitive transcranial magnetic stimulation" },
      { re: /\brtms\b/g, rep: "repetitive transcranial magnetic stimulation" },
      
      { re: /\bPANSS\b/g, rep: "positive and negative syndrome scale" },
      { re: /\bpanss\b/g, rep: "positive and negative syndrome scale" },
      
      { re: /\bSCID\b/g, rep: "structured clinical interview for DSM" },
      { re: /\bscid\b/g, rep: "structured clinical interview for DSM" },
      
      { re: /\bHAM-D\b/g, rep: "Hamilton depression rating scale" },
      { re: /\bham-d\b/g, rep: "Hamilton depression rating scale" },
      
      { re: /\bBDI\b/g, rep: "Beck depression inventory" },
      { re: /\bbdi\b/g, rep: "Beck depression inventory" },
      
      { re: /\bYMRS\b/g, rep: "Young mania rating scale" },
      { re: /\bymrs\b/g, rep: "Young mania rating scale" },
      
      { re: /\bACT\b/g, rep: "acceptance and commitment therapy" }, // Solo mayúsculas para evitar 'act' (verbo/acción)
      
      { re: /\bPDs\b/g, rep: "personality disorders" },
      { re: /\bpds\b/g, rep: "personality disorders" },
      { re: /\bPD\b/g, rep: "personality disorder" }, // Solo mayúsculas para evitar 'pd'
      
      // Roman Numerals (Ordinals)
      { re: /\bII\b/g, rep: "second" },
      { re: /\bIII\b/g, rep: "third" },
      { re: /\bIV\b/g, rep: "fourth" },
      { re: /\bV\b/g, rep: "fifth" },
      { re: /\bVI\b/g, rep: "sixth" },
      { re: /\bVII\b/g, rep: "seventh" },
      { re: /\bVIII\b/g, rep: "eighth" },
      { re: /\bIX\b/g, rep: "ninth" },
      { re: /\bX\b/g, rep: "tenth" },
      
      // Historical / Temporal Elements
      { re: /\bb\.\s*c\./gi, rep: "before christ" },
      { re: /\ba\.\s*d\./gi, rep: "anno domini" },
      { re: /\ba\.\s*de\s*c\./gi, rep: "before christ" },
      { re: /\ba\.\s*c\./gi, rep: "before christ" },
      
      // Unidades de medida (con o sin número previo, ej: 10mg o 10 mg)
      { re: /\b(\d+)\s*mg\b/gi, rep: "$1 milligrams" },
      { re: /\b(\d+)\s*ml\b/gi, rep: "$1 milliliters" },
      { re: /\b(\d+)\s*kg\b/gi, rep: "$1 kilograms" },
      { re: /\b(\d+)\s*mcg\b/gi, rep: "$1 micrograms" },
      { re: /\b(\d+)\s*μg\b/g, rep: "$1 micrograms" },
      { re: /\b(\d+)\s*g\b/gi, rep: "$1 grams" }, // Solo gramos con número previo
      
      { re: /\bmg\b/gi, rep: "milligrams" },
      { re: /\bml\b/gi, rep: "milliliters" },
      { re: /\bmcg\b/gi, rep: "micrograms" }
    ];
    
    for (const rule of siglasEN) {
      res = res.replace(rule.re, rule.rep);
    }
  }
  
  return res;
}
export function calcularScoreReferencia(texto: string): number {
  let score = 0;
  
  // Contiene un año de publicación
  if (/\b(19|20)\d{2}\b/.test(texto)) score += 2;
  
  // Contiene un patrón de volumen/páginas: ej "60:565–571", "30:67-76"
  if (/\b\d+\s*:\s*\d+(?:[–-]\d+)?\b/.test(texto)) score += 3;
  
  // Contiene et al.
  if (/\bet\s+al\b/i.test(texto)) score += 3;
  
  // Contiene doi: o PMID
  if (/doi:|pmid|pmcid/i.test(texto)) score += 4;
  
  // Contiene abreviaturas típicas de revistas médicas
  if (/\b(Psychiatry|Journal|Lancet|Bull|Med|Rev|Clin|Sci|Am\s+J|J\s+Clin|PLoS|Acad)\b/i.test(texto)) score += 2;
  
  // Contiene palabras típicas de editoriales de libros
  if (/\b(Press|University|Arlington|Edition|Publishing)\b/i.test(texto)) score += 1;
  
  // Patrón de nombre de autor al inicio (Ej: "Brown AS,")
  if (/^[A-Z][a-zñáéíóúü]+ [A-Z]{1,2}\b/.test(texto)) score += 2;
  
  return score;
}
export function esFinDeReferencias(para: string): boolean {
  const cleanPara = para.trim();
  if (!cleanPara) return false;
  
  // 1. Cabeceras claras de secciones/capítulos
  const regexHeading = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;
  if (regexHeading.test(cleanPara)) return true;
  

  
  // 2. Firmas o nombres de autores con títulos médicos académicos
  if ((/\b(M\.D\.|Ph\.D\.|M\.P\.H\.|Dr\.P\.H\.|M\.S\.)(?![a-zA-Z])|\b(PhD|MD|MPH|DFAPA)\b/i.test(cleanPara)) && cleanPara.length < 300) {
return true;
  }// 3. Párrafos normales de texto discursivo
  const score = calcularScoreReferencia(cleanPara);
  if (score < 3 && cleanPara.length > 250) {
return true; // Es texto normal largo, detener la eliminación
  }
  
  return false;
}
export function removerReferenciasYAutores(texto: string): string {
  if (!texto) return "";
  
  const lineas = texto.split('\n\n');
  const resultado: string[] = [];
  
  let enReferencias = false;
  let enColaboradores = false;
  
  // Expresiones regulares para detectar cabeceras de bloques
  const regexReferenciasHeader = /^(References|Bibliografía|Bibliografia|Bibliography|Referencias Bibliográficas|Referencias Bibliograficas|Referencias)\s*$/i;
  const regexColaboradoresHeader = /^(Contributors|Colaboradores|List of Contributors|Lista de Colaboradores|Autores|Autores de la obra)\s*$/i;
  
  // Límites para detener la eliminación de colaboradores
  const regexFinColaboradores = /^(Preface|Prefacio|Prólogo|Prologo|Introduction|Introducción|Introduccion|Chapter\s+\d+|Capítulo\s+\d+|Capitulo\s+\d+|PART\s+[I|V|X\d]+|PARTE\s+[I|V|X\d]+|\d+\s+[A-ZÁÉÍÓÚÑÜ])\b/i;

  for (let i = 0; i < lineas.length; i++) {
const para = lineas[i].trim();
if (!para) {
  resultado.push(lineas[i]); // Mantener párrafos vacíos para estructura
  continue;
}

// Preservar marcadores de página pase lo que pase
if (para === '--- PAGE_BREAK ---') {
  resultado.push(lineas[i]);
  continue;
}

// Si estamos en modo colaboradores, revisar si llegamos al final del bloque
if (enColaboradores) {
  if (regexFinColaboradores.test(para)) {
    enColaboradores = false; // Detener la eliminación
  } else {
    // Omitir este párrafo (colaborador o afiliación)
    continue;
  }
}

// Si estamos en modo referencias, revisar si llegamos al final del bloque
if (enReferencias) {
  // Determinar si es un inicio de capítulo/sección nuevo o texto normal que detiene la eliminación
  const esFinReferencias = esFinDeReferencias(para);
  if (esFinReferencias) {
    enReferencias = false; // Detener la eliminación
  } else {
    // Omitir este párrafo (referencia bibliográfica)
    continue;
  }
}

// Detectar inicio de colaboradores
if (regexColaboradoresHeader.test(para)) {
  enColaboradores = true;
  continue; // Omitir el encabezado "Contributors"
}

// Detectar inicio de referencias
if (regexReferenciasHeader.test(para)) {
  enReferencias = true;
  continue; // Omitir el encabezado "References"
}

// Filtrar individualmente párrafos sueltos de conflicto de interés
if (/^(Disclosure of Competing Interests|Conflict of Interest|Conflicts of Interest|Declaración de intereses|Conflictos de interés|Conflicto de intereses)\b/i.test(para)) {
  continue;
}
if (/^The following contributors to this book have indicated/i.test(para)) {
  continue;
}

resultado.push(lineas[i]);
  }
  
  return resultado.join('\n\n');
}
export function esNombreDeRevistaOSeccion(linea: string): boolean {
  if (!linea) return false;
  const l = linea.toLowerCase().trim();
  
  // 1. Nombres explícitos de revistas y publicaciones periódicas
  if (/^(revista|journal|acta|archives|annals|bulletin|cuadernos|anales|boletín|boletin)\b/i.test(l)) return true;
  if (/^(the lancet|bmj|n engl j med|new england journal|american journal|british journal|world psychiatry|uptodate|sonepsyn)\b/i.test(l)) return true;
  if (/\b(psiquiatría|psychiatry|neurología|neurology|neuropsiquiatría|neuropsychiatry|medicina|medicine|salud mental|mental health)\b/i.test(l) &&
      /\b(revista|journal|acta|archives|vol|volumen|nº|n°|no\.|issn|doi)\b/i.test(l)) return true;

  // 2. Encabezados de tipo/sección de artículo
  if (/^(artículo original|articulo original|original article|caso clínico|caso clinico|case report|report of a case|artículo de revisión|articulo de revision|review article|editorial|cartas al editor|letter to the editor|trabajo original|sección especial|seccion especial|comunicación breve|comunicacion breve|special report|brief report|informe especial|comentario|primer)\b/i.test(l)) return true;

  // 3. Formatos de volumen, número, ISSN, DOI, fechas de edición, URLs, numeración de páginas de revista
  if (/^(vol\.|volumen|volume|issue|número|numero|nº|n°|issn|doi:|https?:\/\/)/i.test(l)) return true;
  if (/^vol\s*\d+/i.test(l)) return true;
  if (/^\d{4}\s*;\s*\d+/i.test(l)) return true;
  if (/^págs?\.\s*\d+/i.test(l)) return true;

  return false;
}
/**
 * Une las letras de los títulos compuestos con letras espaciadas
 * ("T R A S T O R N O S   D E   L A" -> "TRASTORNOS DE LA").
 * Solo actúa si la línea es mayoritariamente de letras sueltas, para no
 * pegar palabras de un título normal; los grupos de 2+ espacios se
 * conservan como separadores de palabra.
 */
function unirLetrasEspaciadas(linea: string): string {
  const tokens = linea.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return linea;
  const sueltas = tokens.filter(t => t.length === 1 && /[A-Za-záéíóúñüÁÉÍÓÚÑÜ]/.test(t)).length;
  if (sueltas / tokens.length < 0.6) return linea;
  return linea
    .split(/\s{2,}/)
    .map(palabra => palabra.replace(/([A-Za-záéíóúñüÁÉÍÓÚÑÜ]) (?=[A-Za-záéíóúñüÁÉÍÓÚÑÜ])/g, '$1'))
    .join(' ');
}

export function extraerTituloDePortada(textoPortada) {
  if (!textoPortada) return "TÍTULO NO DETECTADO";
  
  // 1. Dividir en líneas usando saltos de línea reales de la portada
  const lineasRaw = textoPortada.split(/\r?\n/);
  const lineasValidas = [];
  
  for (let i = 0; i < lineasRaw.length; i++) {
    // Eliminar caracteres de control y normalizar espacios horizontales
    let l = unirLetrasEspaciadas(lineasRaw[i].replace(/[\x00-\x1F\x7F-\x9F]/g, ""))
      .replace(/[ \t]+/g, " ")
      .trim();
    if (!l) continue;
    
    // Excluir líneas irrelevantes, créditos editoriales, URLs o avisos de lectura online
    if (l.length <= 4) continue;
    if (/©|isbn|barcelona|editorial|derechos|epub|edicion|herder|cedro|impreso|all rights reserved|coordinador|director/i.test(l)) continue;
    if (/www\.|sonepsyn|leeronline|http|descargado|online/i.test(l)) continue;
    if (/también puedes leer|tambien puedes leer|leer online|psicopatologia|psicoterapia|coleccion|titulos/i.test(l)) continue;
    
    // Excluir nombres de revistas, secciones de revista y metadatos de edición
    if (esNombreDeRevistaOSeccion(l)) continue;

    // Debe contener al menos 3 caracteres alfanuméricos reales para ser un título
    const lettersAndDigits = l.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ0-9]/g, "");
    if (lettersAndDigits.length < 3) continue;
    
    lineasValidas.push(l);
  }
  
  // El título y subtítulo suelen estar en las primeras 2 líneas válidas de la portada
  const lineasTitulo = lineasValidas.slice(0, 2);
  
  if (lineasTitulo.length === 0) {
    return "TÍTULO NO DETECTADO";
  }
  
  return lineasTitulo.join(" - ").toUpperCase();
}
