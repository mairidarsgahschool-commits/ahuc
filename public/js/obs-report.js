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
  function genBiometry() {
    const gs = num('bio_gs', null), crl = num('bio_crl', null), bpd = num('bio_bpd', null);
    const parts = [];
    if (gs) parts.push(`Gestational sac diameter ${gs} mm`);
    if (crl) parts.push(`crown-rump length ${crl} cm`);
    if (bpd) parts.push(`bi-parietal diameter ${bpd} mm`);
    setOut('out_biometry', parts.length ? parts.join(', ') + '.' : '');
  }

  /* ---------------- EDD (auto-calculated from biometry, manual override always wins) ---------------- */
  function calcEDD() {
    const examDateStr = form.dataset.examDate;
    const eddInput = form.querySelector('[name="edd"]');
    if (!examDateStr || !eddInput) return;
    const examDate = new Date(examDateStr + 'T00:00:00');
    if (isNaN(examDate.getTime())) return;

    const crl = parseFloat(num('bio_crl', ''));   // cm
    const gs = parseFloat(num('bio_gs', ''));      // mm
    let gaDays = null;

    if (!isNaN(crl) && crl > 0) {
      // Robinson formula (CRL in mm -> gestational age in days), valid ~CRL 10-84mm
      const crlMm = crl * 10;
      gaDays = 8.052 * Math.sqrt(crlMm) + 23.73;
    } else if (!isNaN(gs) && gs > 0) {
      // Rough mean sac diameter rule of thumb, early first trimester only
      gaDays = gs + 30;
    }
    if (gaDays === null || isNaN(gaDays)) return;

    const daysRemaining = 280 - gaDays;
    const edd = new Date(examDate.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
    if (isNaN(edd.getTime())) return;
    eddInput.value = edd.toISOString().slice(0, 10);
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
