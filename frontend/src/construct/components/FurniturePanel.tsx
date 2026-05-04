import { useAppStore } from '@construct/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { Button } from '@construct/components/ui/button';
import { ScrollArea } from '@construct/components/ui/scroll-area';
import { Armchair, Trash2, RotateCw, Eye, EyeOff, Sofa, BedDouble, UtensilsCrossed, Bath } from 'lucide-react';

const roomIcons: Record<string, typeof Sofa> = {
  living: Sofa, bedroom: BedDouble, kitchen: UtensilsCrossed, bathroom: Bath,
};

export function FurniturePanel() {
  const { furniture, showFurniture, toggleFurniture, removeFurniture, updateFurniture, activeFloor, roomZones } = useAppStore();

  const floorFurniture = furniture.filter(f => activeFloor === -1 || f.floor === activeFloor);
  const grouped = floorFurniture.reduce<Record<string, typeof furniture>>((acc, item) => {
    const zone = roomZones.find(z => z.id === item.roomId);
    const key = zone ? `${zone.type} (${zone.unitId || 'common'})` : 'Unassigned';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Armchair className="w-5 h-5 text-indigo-400" />
              Furniture Manager
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeFloor === -1 ? 'All floors' : `Floor ${activeFloor + 1}`} — {floorFurniture.length} items
            </p>
          </div>
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8 text-xs gap-1" onClick={toggleFurniture}>
            {showFurniture ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showFurniture ? 'Visible' : 'Hidden'}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <Armchair className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No furniture placed</p>
              <p className="text-xs">Generate a building to see auto-placed furniture.</p>
            </div>
          )}

          {Object.entries(grouped).map(([room, items]) => (
            <Card key={room} className="bg-slate-800/60 border-slate-700/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center justify-between">
                  <span className="capitalize">{room}</span>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-900/50 group">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: item.color + '40' }}>
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    </div>
                    <span className="text-xs text-slate-300 flex-1">{item.label}</span>
                    <span className="text-[10px] text-slate-500">{item.width}x{item.depth}m</span>
                    <Button size="icon" variant="ghost" className="w-5 h-5 opacity-0 group-hover:opacity-100"
                      onClick={() => updateFurniture(item.id, { rotation: (item.rotation + 90) % 360 })}>
                      <RotateCw className="w-3 h-3 text-slate-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-5 h-5 opacity-0 group-hover:opacity-100"
                      onClick={() => removeFurniture(item.id)}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
