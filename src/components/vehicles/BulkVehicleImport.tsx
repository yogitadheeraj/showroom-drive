import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download } from 'lucide-react';

interface ParsedVehicle {
  brand: string;
  model: string;
  variant: string;
  year: number;
  color: string;
  registration_number: string;
  location_id: string;
  total_units: number;
  available_units: number;
  fuel_type: string;
  transmission: string;
  valid: boolean;
  error?: string;
}

interface BulkVehicleImportProps {
  locations: { id: string; name: string }[];
  onImportComplete: () => void;
}

const BulkVehicleImport = ({ locations, onImportComplete }: BulkVehicleImportProps) => {
  const [parsedData, setParsedData] = useState<ParsedVehicle[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const locationMap = Object.fromEntries(locations.map(l => [l.name.toLowerCase().trim(), l.id]));

  const downloadTemplate = () => {
    const headers = 'brand,model,variant,year,color,registration_number,location_name,total_units,available_units,fuel_type,transmission';
    const sample = 'Toyota,Camry,XLE,2025,White,,Showroom A,2,2,Petrol,Automatic';
    const blob = new Blob([headers + '\n' + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vehicle_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedVehicle[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });

      const locId = locationMap[row['location_name']?.toLowerCase()] || '';
      const year = parseInt(row['year']) || new Date().getFullYear();
      const totalUnits = parseInt(row['total_units']) || 1;
      const availableUnits = parseInt(row['available_units']) || totalUnits;

      const errors: string[] = [];
      if (!row['brand']) errors.push('Brand required');
      if (!row['model']) errors.push('Model required');
      if (!locId) errors.push('Invalid location');

      return {
        brand: row['brand'] || '',
        model: row['model'] || '',
        variant: row['variant'] || '',
        year,
        color: row['color'] || '',
        registration_number: row['registration_number'] || '',
        location_id: locId,
        total_units: totalUnits,
        available_units: availableUnits,
        fuel_type: row['fuel_type'] || '',
        transmission: row['transmission'] || 'Automatic',
        valid: errors.length === 0,
        error: errors.join(', '),
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParsedData(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.valid);
    if (validRows.length === 0) {
      toast({ title: 'No valid rows to import', variant: 'destructive' });
      return;
    }
    setImporting(true);
    const payload = validRows.map(r => ({
      brand: r.brand,
      model: r.model,
      variant: r.variant || null,
      year: r.year,
      color: r.color || null,
      registration_number: r.registration_number || null,
      location_id: r.location_id,
      total_units: r.total_units,
      available_units: r.available_units,
      fuel_type: r.fuel_type || null,
      transmission: r.transmission || null,
    }));

    const { error } = await supabase.from('vehicles').insert(payload);
    setImporting(false);

    if (error) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${validRows.length} vehicles imported successfully` });
      setParsedData([]);
      setFileName('');
      onImportComplete();
    }
  };

  const validCount = parsedData.filter(r => r.valid).length;
  const invalidCount = parsedData.filter(r => !r.valid).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Bulk Vehicle Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Upload CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          {fileName && <span className="text-sm text-muted-foreground self-center">{fileName}</span>}
        </div>

        {parsedData.length > 0 && (
          <>
            <div className="flex gap-3">
              <Badge variant="secondary" className="bg-success/10 text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} Valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {invalidCount} Invalid
                </Badge>
              )}
            </div>

            <div className="max-h-80 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {row.valid
                          ? <CheckCircle2 className="h-4 w-4 text-success" />
                          : <XCircle className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell>{row.brand}</TableCell>
                      <TableCell>{row.model}</TableCell>
                      <TableCell>{row.variant}</TableCell>
                      <TableCell>{row.year}</TableCell>
                      <TableCell>{row.total_units}</TableCell>
                      <TableCell className="text-xs text-destructive">{row.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={importing || validCount === 0} className="bg-primary text-primary-foreground">
              {importing ? 'Importing...' : `Import ${validCount} Vehicles`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkVehicleImport;
