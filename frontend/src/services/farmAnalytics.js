function categoryName(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

export function summarizeFarms(farms = []) {
  let totalAcres = 0;
  const crops = new Map();
  const soils = new Map();
  for (const farm of farms) {
    totalAcres += farm.area_acres;
    for (const [groups, value] of [[crops, farm.crop], [soils, farm.soil_type]]) {
      const name = categoryName(value);
      const group = groups.get(name) || { name, areaAcres: 0, farmCount: 0 };
      group.areaAcres += farm.area_acres;
      group.farmCount += 1;
      groups.set(name, group);
    }
  }
  const breakdown = groups => [...groups.values()]
    .map(group => ({ ...group, share: totalAcres > 0 ? Math.min(100, group.areaAcres / totalAcres * 100) : 0 }))
    .sort((left, right) => right.areaAcres - left.areaAcres || left.name.localeCompare(right.name, 'en'));
  return { farmCount: farms.length, totalAcres, cropCount: crops.size, crops: breakdown(crops), soils: breakdown(soils) };
}
