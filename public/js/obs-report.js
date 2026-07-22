(function () {
  const form = document.getElementById('obsForm');
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
  function setOut(id, text) {
    const el = document.getElementById(id);
    if (el) el.value = text;
  }

  /* ---------------- GESTATION ---------------- */
  function genGestation() {
    const fetus = val('ges_fetus');
    const fetusWord = fetus === 'twin' ? 'Twin' : fetus === 'triplet' ? 'Triplet' : 'Single';
    const distress = val('ges_distress');
    const distressWord = distress === 'distress' ? 'in distress' : distress === 'dead' ? 'dead' : 'alive';
    const noun = fetus === 'single' ? 'fetus' : 'fetuses';
    setOut('out_gestation', `${fetusWord} ${distressWord} ${noun}.`);
  }

  /* ---------------- AMNIOTIC FLUID ---------------- */
  function genAmniotic() {
    const qty = val('af_qty');
    if (qty === 'moderate') {
      setOut('out_amniotic', 'Amniotic fluid is normal.');
      return;
    }
    const label = qty === 'oligo' ? 'Oligohydramnios' : 'Polyhydramnios';
    const sev = val('af_severity');
    const sevWord = sev === 'mild' ? 'mild' : sev === 'mildmod' ? 'mild to moderate' : sev === 'severe' ? 'severe' : '';
    setOut('out_amniotic', `${label} noted${sevWord ? ', ' + sevWord + ' in severity' : ''}.`);
  }

  /* ---------------- PLACENTA ---------------- */
  function genPlacenta() {
    const pos = val('pl_position');
    if (pos === 'previa') {
      const type = val('pl_type');
      const typeWord = type && type !== 'nocomments' ? ` (${type.replace('type ', 'Type ').toUpperCase().replace('TYPE ', 'Type ')})` : '';
      setOut('out_placenta', `Placenta previa noted${typeWord}.`);
      return;
    }
    setOut('out_placenta', `Placenta is ${pos} in position.`);
  }

  /* ---------------- C.V.S ---------------- */
  function genCVS() {
    const activity = val('cvs_activity');
    if (activity === 'normal') {
      setOut('out_cvs', 'Fetal cardiac activity and fetal cardiac chambers are normal.');
    } else if (activity === 'distress') {
      setOut('out_cvs', 'Fetal cardiac activity is in distress.');
    } else {
      setOut('out_cvs', 'Fetal cardiac activity is absent.');
    }
  }

  /* ---------------- LIE ---------------- */
  function genLie() {
    const vertical = val('lie_vertical');
    const transverse = val('lie_transverse');
    if (transverse !== 'nocomments') {
      setOut('out_lie', `Lie is transverse, ${transverse === 'rtflank' ? 'head in right flank' : 'head in left flank'}.`);
      return;
    }
    if (vertical === 'nocomments') {
      setOut('out_lie', 'Lie not commented on at this stage.');
      return;
    }
    setOut('out_lie', `Lie is vertical with ${vertical} presentation.`);
  }

  /* ---------------- FETAL MORPHOLOGY ---------------- */
  function genMorphology() {
    const fields = ['fm_ventricles', 'fm_csf', 'fm_cerebrum', 'fm_cerebellum', 'fm_orbits', 'fm_spine', 'fm_liver', 'fm_kidney', 'fm_bladder', 'fm_cord', 'fm_chest'];
    const allNormal = fields.every((f) => val(f) === 'normal');

    if (allNormal) {
      setOut('out_morphology', 'All the ventricles are normal, and not dilated. C.S.F is normal. Both cerebrum and orbits are normal. Chest, abdomen and umbilical cord is normal.');
      return;
    }

    const sentences = [];
    sentences.push(val('fm_ventricles') === 'dilated' ? 'Ventricles are dilated.' : 'Ventricles are normal and not dilated.');
    sentences.push(val('fm_csf') === 'abnormal' ? 'C.S.F is abnormal.' : 'C.S.F is normal.');
    sentences.push(val('fm_cerebrum') === 'abnormal' ? 'Cerebrum is abnormal.' : 'Cerebrum is normal.');
    sentences.push(val('fm_cerebellum') === 'abnormal' ? 'Cerebellum is abnormal.' : 'Cerebellum is normal.');
    sentences.push(val('fm_orbits') === 'protruded' ? 'Orbits appear protruded.' : 'Orbits are normal.');
    sentences.push(val('fm_spine') === 'abnormal' ? 'Spine is abnormal.' : 'Spine is normal.');
    sentences.push(val('fm_liver') === 'abnormal' ? 'Fetal liver is abnormal.' : 'Fetal liver is normal.');
    sentences.push(val('fm_kidney') === 'abnormal' ? 'Fetal kidneys are abnormal.' : 'Fetal kidneys are normal.');
    sentences.push(val('fm_bladder') === 'abnormal' ? 'Fetal bladder is abnormal.' : 'Fetal bladder is normal.');
    sentences.push(val('fm_chest') === 'abnormal' ? 'Chest is abnormal.' : 'Chest is normal.');
    if (val('fm_cord') === 'abnormal') {
      const cordType = form.querySelector('[name="fm_cord_type"]').value;
      sentences.push(`Umbilical cord is abnormal (${cordType}).`);
    } else {
      sentences.push('Umbilical cord is normal.');
    }
    setOut('out_morphology', sentences.join(' '));
  }

  /* ---------------- BIOMETRY ---------------- */
  // Matches the old system's wording: state the measurement, then the estimated age.
  // (EDD itself is shown as its own report line, not folded into this text.)
  function genBiometry() {
    const gs = parseFloat(num('bio_gs', ''));    // mm
    const crl = parseFloat(num('bio_crl', ''));  // cm
    const bpd = parseFloat(num('bio_bpd', ''));  // mm

    const parts = [];
    if (!isNaN(bpd) && bpd > 0) {
      const gaWeeks = (gestAgeDaysFromBPD(bpd) / 7).toFixed(1);
      parts.push(`B.P.D is ${bpd} mm.  Age is about ${gaWeeks} weeks.`);
    }
    if (!isNaN(crl) && crl > 0) {
      const gaWeeks = (gestAgeDaysFromCRL(crl) / 7).toFixed(1);
      parts.push(`Crown-rump length is ${crl} cm, age is about ${gaWeeks} weeks.`);
    }
    if (!isNaN(gs) && gs > 0) {
      const gaWeeks = (gestAgeDaysFromGS(gs) / 7).toFixed(1);
      parts.push(`Gestational sac diameter is ${gs} mm, age is about ${gaWeeks} weeks.`);
    }
    setOut('out_biometry', parts.join('  '));
  }

  /* ---------------- Gestational age formulas ---------------- */
  // Diameter of Gestational Sac — very early pregnancy (roughly weeks 1–9),
  // mean sac diameter rule of thumb: GA(days) ≈ MSD(mm) + 30.
  function gestAgeDaysFromGS(gsMm) {
    return gsMm + 30;
  }
  // Crown-Rump Length — roughly weeks 10–11 dating window,
  // Robinson formula: GA(days) = 8.052 x sqrt(CRL in mm) + 23.73.
  function gestAgeDaysFromCRL(crlCm) {
    const crlMm = crlCm * 10;
    return 8.052 * Math.sqrt(crlMm) + 23.73;
  }
  // Bi-Parietal Diameter — later pregnancy (roughly 11+ weeks),
  // Hadlock BPD-only regression: GA(weeks) = 9.54 + 1.482*BPD(cm) + 0.1676*BPD(cm)^2.
  function gestAgeDaysFromBPD(bpdMm) {
    const bpdCm = bpdMm / 10;
    const gaWeeks = 9.54 + 1.482 * bpdCm + 0.1676 * bpdCm * bpdCm;
    return gaWeeks * 7;
  }

  /* ---------------- EDD (auto-calculated from biometry, manual override always wins) ---------------- */
  function calcEDD() {
    const examDateStr = form.dataset.examDate;
    const eddInput = form.querySelector('[name="edd"]');
    if (!examDateStr || !eddInput) return;
    const examDate = new Date(examDateStr + 'T00:00:00');
    if (isNaN(examDate.getTime())) return;

    const gs = parseFloat(num('bio_gs', ''));
    const crl = parseFloat(num('bio_crl', ''));
    const bpd = parseFloat(num('bio_bpd', ''));
    let gaDays = null;

    // Later measurements take priority when more than one is filled in, since
    // that's the one actually usable at this stage of the pregnancy.
    if (!isNaN(bpd) && bpd > 0) {
      gaDays = gestAgeDaysFromBPD(bpd);
    } else if (!isNaN(crl) && crl > 0) {
      gaDays = gestAgeDaysFromCRL(crl);
    } else if (!isNaN(gs) && gs > 0) {
      gaDays = gestAgeDaysFromGS(gs);
    }
    if (gaDays === null || isNaN(gaDays)) return;

    const daysRemaining = 280 - gaDays;
    const edd = new Date(examDate.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
    if (isNaN(edd.getTime())) return;
    eddInput.value = edd.toISOString().slice(0, 10);
    genBiometry(); // keep the findings text in sync with the freshly calculated date
  }

  const generators = {
    gestation: genGestation,
    amniotic: genAmniotic,
    placenta: genPlacenta,
    cvs: genCVS,
    lie: genLie,
    morphology: genMorphology,
    biometry: genBiometry
  };

  form.querySelectorAll('details.organ[data-organ]').forEach((section) => {
    const key = section.getAttribute('data-organ');
    const generate = generators[key];
    if (!generate) return;
    section.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('change', generate);
    });
  });

  // Auto-calculate EDD only when the measurements that drive it change —
  // never on the EDD field itself, so a manual edit is never clobbered.
  const crlInput = form.querySelector('[name="bio_crl"]');
  const gsInput = form.querySelector('[name="bio_gs"]');
  if (crlInput) crlInput.addEventListener('change', calcEDD);
  if (gsInput) gsInput.addEventListener('change', calcEDD);
})();
