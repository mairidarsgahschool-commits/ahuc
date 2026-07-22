(function () {
  const form = document.getElementById('organForm');
  if (!form) return;

  function val(name) {
    const el = form.querySelector(`[name="${name}"]:checked`);
    return el ? el.value : null;
  }
  function num(name, fallback) {
    const el = form.querySelector(`[name="${name}"]`);
    const v = el ? el.value : '';
    return v === '' ? fallback : v;
  }
  function selVal(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value : '';
  }
  function checked(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.checked : false;
  }
  function setOut(id, text) {
    const el = document.getElementById(id);
    if (el) el.value = text;
  }

  /* ---------------- LIVER ---------------- */
  function genLiver() {
    const parts = [];
    const size = val('liver_size');
    if (size === 'normal') parts.push('Liver is normal in size');
    else if (size === 'enlarged') parts.push(`Liver is enlarged in size (${num('liver_size_cm', 'measured')} cm)`);
    else if (size === 'shrinked') parts.push(`Liver is reduced in size (${num('liver_size_cm', 'measured')} cm)`);
    // 'nocomments' → size sentence omitted entirely

    const par = val('liver_parenchyma');
    if (par === 'coarse') parts.push('with coarse echotexture and smooth outline');
    else if (par === 'fatty') parts.push('with diffusely increased echogenicity, in keeping with fatty infiltration (steatosis)');
    else if (par === 'normal') parts.push('with homogenous echotexture and smooth outline');
    // 'nocomments' → parenchyma clause omitted

    const sentences = [];
    if (parts.length) sentences.push(parts.join(', ') + '.');

    const echo = val('liver_echo');
    if (echo === 'hyper') sentences.push('Hepatic parenchyma is hyperechogenic.');
    else if (echo === 'hypo') sentences.push('Hepatic parenchyma is hypoechogenic.');
    // 'iso' is the normal baseline (already implied above) and 'nocomments' adds nothing

    if (val('liver_mass') === 'present') {
      const kind = selVal('liver_mass_kind');
      const nouns = {
        cyst: 'A simple, well-defined anechoic cyst',
        solid: 'A solid mass',
        hemangioma: 'A well-defined hyperechoic lesion, in keeping with a hemangioma,',
        abscess: 'A hypoechoic collection, in keeping with an abscess,',
        hydatid: 'A cystic lesion with septations, in keeping with a hydatid cyst,'
      };
      sentences.push(`${nouns[kind] || 'A lesion'} is seen in the ${selVal('liver_mass_location')}, measuring ${num('liver_mass_w', 0)} x ${num('liver_mass_h', 0)} mm.`);
    } else {
      sentences.push('No mass or cyst seen in it.');
    }

    const disease = val('liver_disease');
    const diseaseText = {
      cirrhosis: 'Liver shows a nodular, coarsened contour with irregular surface, in keeping with cirrhotic change.',
      hepatomegaly: 'Liver is diffusely enlarged, in keeping with hepatomegaly.',
      hemangioma: 'A hyperechoic lesion is noted, in keeping with a hepatic hemangioma.',
      abscess: 'A hypoechoic collection is noted, in keeping with a hepatic abscess.',
      hydatid: 'A well-defined cystic lesion with internal septations is noted, in keeping with a hydatid cyst.',
      calcification: 'Scattered calcific foci are noted within the liver parenchyma.'
    };
    if (disease && disease !== 'none' && diseaseText[disease]) sentences.push(diseaseText[disease]);

    const bile = val('liver_bile_ducts'), vessels = val('liver_vessels');
    if (bile === 'normal' && vessels === 'normal') {
      sentences.push('Intrahepatic biliary ducts and blood vessels are not dilated.');
    } else {
      if (bile === 'dilated') sentences.push('Intrahepatic biliary ducts are dilated.');
      else if (bile === 'normal') sentences.push('Intrahepatic biliary ducts are not dilated.');
      if (vessels === 'dilated') sentences.push('Hepatic blood vessels are dilated.');
      else if (vessels === 'normal') sentences.push('Hepatic blood vessels are not dilated.');
    }

    const cbd = val('liver_cbd');
    if (cbd === 'dilated') {
      sentences.push(`Common bile duct is dilated, likely due to ${selVal('liver_cbd_cause')}.`);
    } else if (cbd === 'normal') {
      sentences.push('Common bile duct is normal.');
    }
    setOut('out_liver', sentences.join('  '));
  }

  /* ---------------- GALL BLADDER ---------------- */
  function genGB() {
    const sentences = [];
    const L = num('gb_len', null), W = num('gb_width', null), T = num('gb_thick', null);
    if (L || W || T) sentences.push(`Gall bladder measures ${L || '—'} x ${W || '—'} x ${T || '—'} mm.`);

    sentences.push(val('gb_wall') === 'thickened'
      ? 'Gall bladder wall appears thickened with oedema.'
      : 'G.Bladder has normal interior with smooth outline. No thickening or oedema of its wall.');

    const stone = val('gb_stone');
    if (stone === 'none') sentences.push('No gall stone or mass is detected.');
    else if (stone === 'polyp') sentences.push('A gall bladder polyp is noted.');
    else {
      const impacted = checked('gb_stone_impacted') ? ', impacted in the neck' : '';
      sentences.push(`${stone === 'single' ? 'A single gall stone is' : 'Multiple gall stones are'} seen${impacted}.`);
    }

    const sludge = val('gb_sludge');
    if (sludge !== 'none') sentences.push(`${sludge === 'settled' ? 'Settled' : 'Scattered'} sludge/debris noted within the gall bladder.`);

    const cd = val('gb_cystic_duct'), cbd = val('gb_cbd');
    sentences.push(`Cystic duct is ${cd === 'dilated' ? 'dilated' : 'normal'} and C.B.D is ${cbd === 'dilated' ? 'dilated' : 'normal'}.`);
    setOut('out_gb', sentences.join(' '));
  }

  /* ---------------- PANCREAS ---------------- */
  function genPancreas() {
    const sentences = [];
    const state = val('pancreas_normal');
    if (state === 'normal') sentences.push('Body, head and tail are normal in shape, size and echotexture.');
    else if (state === 'pancreatitis') sentences.push('Pancreas is diffusely enlarged with heterogeneous echotexture, in keeping with pancreatitis.');
    else sentences.push('Pancreas shows abnormal echotexture.');
    if (val('pancreas_mass') === 'present') {
      sentences.push(`A ${selVal('pancreas_mass_type')} mass is seen in the ${selVal('pancreas_mass_location')} of pancreas, measuring ${num('pancreas_mass_w', 0)} x ${num('pancreas_mass_h', 0)} mm.`);
    }
    setOut('out_pancreas', sentences.join(' '));
  }

  /* ---------------- SPLEEN ---------------- */
  function genSpleen() {
    const sentences = [];
    const size = val('spleen_size');
    sentences.push(size === 'normal' ? 'Normal in shape and size.' : `Spleen is ${size} enlarged in size.`);
    const echo = val('spleen_echo');
    if (echo === 'normal') sentences.push('Neither focal or diffuse lesion seen.');
    else sentences.push(`Echotexture is abnormal, ${echo === 'stone' ? 'due to stone deposits' : 'due to a mass lesion'}.`);
    setOut('out_spleen', sentences.join(' '));
  }

  /* ---------------- KIDNEY (shared by right/left) ---------------- */
  function genKidney(prefix, outId) {
    const sentences = [];
    const size = val(`${prefix}_size`), outline = val(`${prefix}_outline`);
    if (size === 'normal' && outline === 'normal') {
      sentences.push('It has normal size, shape and smooth outline. Renal cortical thickness is normal.');
    } else {
      sentences.push(`Kidney is ${size === 'abnormal' ? 'abnormal in size' : 'normal in size'} with ${outline === 'irregular' ? 'an irregular' : 'a smooth'} outline.`);
      const L = num(`${prefix}_len`, null), T = num(`${prefix}_thick`, null), C = num(`${prefix}_cortex`, null);
      if (L || T || C) sentences.push(`Length ${L || '—'} mm, thickness ${T || '—'} mm, cortical thickness ${C || '—'} mm.`);
    }

    if (val(`${prefix}_stones`) === 'no') sentences.push('No calculus seen.');
    else sentences.push(`${selVal(prefix + '_stones_count') === 'single' ? 'A single calculus' : 'Multiple calculi'} noted, measuring ${num(prefix + '_stones_w', 0)} x ${num(prefix + '_stones_h', 0)} mm.`);

    if (val(`${prefix}_mass`) === 'yes') sentences.push(`A ${selVal(prefix + '_mass_type')} mass is seen.`);

    if (val(`${prefix}_cyst`) === 'yes') {
      sentences.push(`A simple cortical cyst is noted in the ${selVal(prefix + '_cyst_pole')}, measuring ${num(prefix + '_cyst_size', 0)} mm.`);
    }

    if (val(`${prefix}_hydro`) === 'no') sentences.push('No sign of obstruction / hydronephrosis.');
    else sentences.push('Hydronephrosis is present.');

    const ureter = val(`${prefix}_ureter`), puj = val(`${prefix}_puj`);
    if (ureter === 'dilated') sentences.push('Ureter is dilated.');
    if (puj === 'dilated') sentences.push('P.U.J is dilated.');

    setOut(outId, sentences.join(' '));
  }

  /* ---------------- URINARY BLADDER ---------------- */
  function genUB() {
    const sentences = [];
    if (val('ub_interior') === 'normal') {
      sentences.push('It has normal interior with no thickening or oedema of its walls.');
    } else {
      const wider = checked('ub_mass_wider') ? ' (width greater than length)' : '';
      sentences.push(`A ${selVal('ub_mass_echo')} mass is seen in the ${selVal('ub_mass_location')} bladder wall${wider}, measuring ${num('ub_mass_w', 0)} x ${num('ub_mass_h', 0)} mm.`);
    }
    if (val('ub_walls') === 'normal') sentences.push('No vesical calculus is seen.');
    else sentences.push(`${selVal('ub_stone_count') === 'single' ? 'A single vesical calculus is' : 'Multiple vesical calculi are'} seen, measuring ${num('ub_stone_w', 0)} x ${num('ub_stone_h', 0)} mm.`);
    setOut('out_ub', sentences.join(' '));
  }

  /* ---------------- PROSTATE ---------------- */
  function genProstate() {
    const sentences = [];
    if (val('pr_normal') === 'normal') {
      sentences.push('It has normal size, shape and echotexture. No calcified tissue is seen in it.');
    } else {
      sentences.push(`Prostate is abnormal in size/echotexture. A.P.D ${num('pr_apd', '—')} mm.`);
    }
    sentences.push(val('pr_capsule') === 'intact' ? 'Prostatic capsule is intact.' : 'Prostatic capsule is not intact.');
    if (val('pr_lobes') === 'enlarged') sentences.push('Lobes are enlarged.');
    if (val('pr_residual') === 'yes') sentences.push(`Residual urine present, volume ${num('pr_residual_vol', 0)} ml.`);
    const remarks = val('pr_remarks');
    if (remarks === 'prostatitis') sentences.push('Findings are suggestive of prostatitis.');
    if (remarks === 'bph') sentences.push('Findings are suggestive of benign prostatic hyperplasia (BPH).');
    if (remarks === 'calcification') sentences.push('Scattered calcific foci are noted within the gland.');
    setOut('out_prostate', sentences.join(' '));
  }

  /* ---------------- OTHERS ---------------- */
  function genOthers() {
    const sentences = [];
    if (val('oth_mass') === 'none') sentences.push('No mass, cyst or free fluid seen in abdominal cavity.');
    else sentences.push(`A ${selVal('oth_mass_type')} mass/cyst is seen, measuring ${num('oth_mass_w', 0)} x ${num('oth_mass_h', 0)} mm.`);
    if (val('oth_fluid') === 'yes') sentences.push('Free fluid is present in the abdominal cavity.');
    sentences.push(val('oth_nodes') === 'enlarged' ? 'Lymph nodes appear enlarged.' : 'Midline vessels are normal.');
    setOut('out_others', sentences.join(' '));
  }

  const generators = {
    liver: genLiver,
    gb: genGB,
    pancreas: genPancreas,
    spleen: genSpleen,
    kidney_r: () => genKidney('kr', 'out_kidney_r'),
    kidney_l: () => genKidney('kl', 'out_kidney_l'),
    ub: genUB,
    prostate: genProstate,
    others: genOthers
  };

  form.querySelectorAll('details.organ[data-organ]').forEach((section) => {
    const key = section.getAttribute('data-organ');
    const generate = generators[key];
    if (!generate) return;
    section.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('change', generate);
    });
  });
})();
