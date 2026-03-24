import React from 'react';

export default function ChartModal({ isOpen, onClose, currentChartConfig, setCurrentChartConfig, selectedSubTheme, getUniqueValuesForColumn, handleAddOrUpdateChart }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
      <div className="bg-[#fef9f2] border-4 border-black p-8 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xl font-black mb-6 text-center uppercase sticky top-0 bg-[#fef9f2]">Paramètres du Graphique</h2>

        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-1">Type :</label>
            <select 
              className="w-full p-2 border-2 border-black rounded-lg bg-white"
              value={currentChartConfig.type}
              onChange={e => setCurrentChartConfig({...currentChartConfig, type: e.target.value})}
            >
              <option value="Histogramme">Barres (Histogramme)</option>
              <option value="Courbes">Lignes (Courbes)</option>
              <option value="Nuage de points">Nuage de points (Scatter)</option>
              <option value="Secteur">Secteur (Pie)</option>
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-bold mb-1">Axe X :</label>
              <select 
                className="w-full p-2 border-2 border-black rounded-lg bg-white"
                value={currentChartConfig.x}
                onChange={e => {
                  const newX = e.target.value;
                  setCurrentChartConfig({...currentChartConfig, x: newX, y: (currentChartConfig.y === newX ? '' : currentChartConfig.y)});
                }}
              >
                <option value="">Sélectionner</option>
                {selectedSubTheme?.columns?.map(c => <option key={c} value={c} disabled={c === currentChartConfig.y}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block font-bold mb-1">Axe Y :</label>
              <select 
                className="w-full p-2 border-2 border-black rounded-lg bg-white"
                value={currentChartConfig.y}
                onChange={e => {
                  const newY = e.target.value;
                  setCurrentChartConfig({...currentChartConfig, y: newY, x: (currentChartConfig.x === newY ? '' : currentChartConfig.x)});
                }}
              >
                <option value="">Sélectionner</option>
                {selectedSubTheme?.columns?.map(c => c !== currentChartConfig.x ? <option key={c} value={c}>{c}</option> : null)}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Filtre par colonne (optionnel) :</label>
            <select
              className="w-full p-2 border-2 border-black rounded-lg bg-white"
              value={currentChartConfig.filter_column || ''}
              onChange={e => setCurrentChartConfig({
                ...currentChartConfig,
                filter_column: e.target.value,
                filter_value: ''
              })}
            >
              <option value="">-- Aucun filtre --</option>
              {selectedSubTheme?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {currentChartConfig.filter_column && (
            <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
              <label className="block font-bold mb-2 text-blue-900">Sélectionner la valeur '{currentChartConfig.filter_column}' :</label>
              <select
                className="w-full p-2 border-2 border-blue-400 rounded-lg bg-white font-bold"
                value={currentChartConfig.filter_value || ''}
                onChange={e => setCurrentChartConfig({
                  ...currentChartConfig,
                  filter_value: e.target.value
                })}
              >
                <option value="">-- Choisir une année --</option>
                {getUniqueValuesForColumn(currentChartConfig.filter_column).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              
              <div className="flex gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filter_mode"
                    value="include"
                    checked={currentChartConfig.filter_mode === 'include'}
                    onChange={e => setCurrentChartConfig({...currentChartConfig, filter_mode: e.target.value})}
                    className="w-4 h-4"
                  />
                  <span className="font-bold text-green-700">✓ Inclure</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filter_mode"
                    value="exclude"
                    checked={currentChartConfig.filter_mode === 'exclude'}
                    onChange={e => setCurrentChartConfig({...currentChartConfig, filter_mode: e.target.value})}
                    className="w-4 h-4"
                  />
                  <span className="font-bold text-red-700">✕ Exclure</span>
                </label>
              </div>
            </div>
          )}

          {/* FILTRES SUPPLÉMENTAIRES (MULTIPLES) */}
          {currentChartConfig.filters && currentChartConfig.filters.length > 0 && (
            <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg space-y-3">
              <h3 className="font-bold text-purple-900">Filtres supplémentaires :</h3>
              {currentChartConfig.filters.map((filter, idx) => (
                <div key={idx} className="p-3 bg-white border border-purple-300 rounded space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-2 border-2 border-purple-300 rounded bg-white font-bold text-sm"
                      value={filter.column || ''}
                      onChange={e => {
                        const newFilters = [...currentChartConfig.filters];
                        newFilters[idx].column = e.target.value;
                        newFilters[idx].value = '';
                        setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                      }}
                    >
                      <option value="">-- Colonne --</option>
                      {selectedSubTheme?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    
                    {filter.column && (
                      <select
                        className="flex-1 p-2 border-2 border-purple-300 rounded bg-white font-bold text-sm"
                        value={filter.value || ''}
                        onChange={e => {
                          const newFilters = [...currentChartConfig.filters];
                          newFilters[idx].value = e.target.value;
                          setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                        }}
                      >
                        <option value="">-- Valeur --</option>
                        {getUniqueValuesForColumn(filter.column).map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={() => {
                        const newFilters = currentChartConfig.filters.filter((_, i) => i !== idx);
                        setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                      }}
                      className="px-3 py-2 bg-red-300 border-2 border-black rounded font-bold text-sm hover:bg-red-400"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {filter.value && (
                    <div className="flex gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={(filter.mode || 'include') === 'include'}
                          onChange={() => {
                            const newFilters = [...currentChartConfig.filters];
                            newFilters[idx].mode = 'include';
                            setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-bold text-green-700">✓ Inclure</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={(filter.mode || 'include') === 'exclude'}
                          onChange={() => {
                            const newFilters = [...currentChartConfig.filters];
                            newFilters[idx].mode = 'exclude';
                            setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                          }}
                          className="w-4 h-4"
                        />
                        <span className="font-bold text-red-700">✕ Exclure</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
              
              <button
                onClick={() => {
                  const newFilters = [...currentChartConfig.filters, { column: '', value: '', mode: 'include' }];
                  setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                }}
                className="w-full py-2 bg-purple-300 border-2 border-purple-700 rounded font-bold hover:bg-purple-400 text-sm"
              >
                + Ajouter un filtre
              </button>
            </div>
          )}

          {/* BOUTON POUR AJOUTER LE PREMIER FILTRE SUPPLÉMENTAIRE */}
          {(!currentChartConfig.filters || currentChartConfig.filters.length === 0) && currentChartConfig.filter_column && (
            <button
              onClick={() => {
                const newFilters = [{ column: '', value: '', mode: 'include' }];
                setCurrentChartConfig({...currentChartConfig, filters: newFilters});
              }}
              className="w-full py-2 bg-purple-200 border-2 border-purple-500 rounded font-bold hover:bg-purple-300 text-sm text-purple-900"
            >
              + Ajouter un filtre supplémentaire
            </button>
          )}

          {/* Chart-level visible filters for visitors */}
          <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg space-y-3">
            <h3 className="font-bold text-yellow-900">Filtres visibles pour le visiteur (ce graphique)</h3>
            {(currentChartConfig.visible_filters || []).map((vf, idx) => {
              const col = (typeof vf === 'string') ? vf : (vf && vf.column) || '';
              const defVal = (typeof vf === 'object' && vf) ? (vf.default || '') : '';
              return (
                <div key={idx} className="p-2 bg-white border rounded flex gap-2 items-center">
                  <select
                    className="flex-1 p-2 border-2 border-yellow-300 rounded bg-white"
                    value={col}
                    onChange={e => {
                      const newVis = [...(currentChartConfig.visible_filters || [])];
                      newVis[idx] = { column: e.target.value, default: '' };
                      setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                    }}
                  >
                    <option value="">-- Colonne à afficher --</option>
                    {selectedSubTheme?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {col && (
                    <select
                      className="w-48 p-2 border-2 border-yellow-300 rounded bg-white"
                      value={defVal}
                      onChange={e => {
                        const newVis = [...(currentChartConfig.visible_filters || [])];
                        const item = (typeof newVis[idx] === 'string') ? { column: newVis[idx], default: '' } : (newVis[idx] || {});
                        item.default = e.target.value;
                        newVis[idx] = item;
                        setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                      }}
                    >
                      <option value="">-- Défaut (aucun) --</option>
                      {getUniqueValuesForColumn(col).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}

                  <button
                    onClick={() => {
                      const newVis = (currentChartConfig.visible_filters || []).filter((_, i) => i !== idx);
                      setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                    }}
                    className="px-3 py-2 bg-red-300 border-2 border-black rounded font-bold text-sm hover:bg-red-400"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => {
                const newVis = [...(currentChartConfig.visible_filters || []), { column: '', default: '' }];
                setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
              }}
              className="w-full py-2 bg-yellow-200 border-2 border-yellow-700 rounded font-bold hover:bg-yellow-300 text-sm"
            >
              + Ajouter un filtre visible
            </button>
          </div>

          <div>
            <label className="block font-bold mb-1">Ajouter une mesure / note :</label>
            <textarea 
              className="w-full p-2 border-2 border-black rounded-lg h-20 outline-none"
              value={currentChartConfig.mesure}
              onChange={e => setCurrentChartConfig({...currentChartConfig, mesure: e.target.value})}
              placeholder="Expliquez ce graphique..."
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Mesure / note en arabe (optionnel) :</label>
            <textarea
              className="w-full p-2 border-2 border-black rounded-lg h-20 outline-none"
              value={currentChartConfig.mesure_ar || ''}
              onChange={e => setCurrentChartConfig({...currentChartConfig, mesure_ar: e.target.value})}
              placeholder="ملاحظة أو وصف المخطط بالعربية..."
              dir="rtl"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block font-bold mb-1">Titre du graphique (affiché au-dessus) :</label>
              <input
                type="text"
                className="w-full p-2 border-2 border-black rounded-lg bg-white"
                value={currentChartConfig.title || ''}
                onChange={e => setCurrentChartConfig({...currentChartConfig, title: e.target.value})}
                placeholder="Titre du graphique"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Titre en arabe (optionnel) :</label>
              <input
                type="text"
                className="w-full p-2 border-2 border-black rounded-lg bg-white"
                value={currentChartConfig.title_ar || ''}
                onChange={e => setCurrentChartConfig({...currentChartConfig, title_ar: e.target.value})}
                placeholder="العنوان بالعربية"
                dir="rtl"
              />
            </div>

            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg space-y-3">
              <label className="block font-bold mb-1">Grouper par colonne (crée plusieurs séries)</label>
              <select
                className="w-full p-2 border-2 border-green-300 rounded bg-white"
                value={currentChartConfig.group_by || ''}
                onChange={e => setCurrentChartConfig({...currentChartConfig, group_by: e.target.value})}
              >
                <option value="">-- Aucun --</option>
                {selectedSubTheme?.columns?.map(c => (
                  <option key={c} value={c} disabled={c === currentChartConfig.x}>{c}{c === currentChartConfig.x ? ' (disable : same as X)' : ''}</option>
                ))}
              </select>
              {currentChartConfig.group_by === currentChartConfig.x && currentChartConfig.group_by !== '' && (
                <div className="text-sm text-red-600 mt-1">Le groupement sur la même colonne que l'axe X produit des séries avec beaucoup de zéros — choisissez une colonne différente (ex: Province).</div>
              )}
              <div className="text-xs italic text-gray-600">Sélectionnez une colonne dont les valeurs définiront une courbe/série distincte (ex: Province).</div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block font-bold mb-1">Label Axe X (optionnel)</label>
                <input
                  type="text"
                  className="w-full p-2 border-2 border-black rounded-lg bg-white"
                  value={currentChartConfig.x_label || ''}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, x_label: e.target.value})}
                  placeholder="Ex: Année, Catégorie"
                />
              </div>
              <div className="flex-1">
                <label className="block font-bold mb-1">Label Axe Y (optionnel)</label>
                <input
                  type="text"
                  className="w-full p-2 border-2 border-black rounded-lg bg-white"
                  value={currentChartConfig.y_label || ''}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, y_label: e.target.value})}
                  placeholder="Ex: Valeur (%), Effectif"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8 sticky bottom-0 pt-4 bg-[#fef9f2]">
          <button onClick={onClose} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
          <button onClick={handleAddOrUpdateChart} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold shadow-md">
            {currentChartConfig.id ? "Modifier" : "Générer"}
          </button>
        </div>
      </div>
    </div>
  );
}
