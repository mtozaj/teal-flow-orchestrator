
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Settings as SettingsIcon, Database, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const [apiSettings, setApiSettings] = useState({
    tealApiKey: '',
    tealApiSecret: '',
    tmoUuid: 'cda438862b284bcdaec82ee516eada14',
    verizonUuid: '3c8fbbbc3ab442b8bc2f244c5180f9d1',
    globalUuid: '493bdfc2eccb415ea63796187f830784',
    attUuid: 'cd27b630772d4d8f915173488b7bfcf1'
  });

  const { toast } = useToast();

  const handleSaveApiSettings = () => {
    // Save API settings to localStorage or environment
    localStorage.setItem('tealApiKey', apiSettings.tealApiKey);
    localStorage.setItem('tealApiSecret', apiSettings.tealApiSecret);
    localStorage.setItem('tmoUuid', apiSettings.tmoUuid);
    localStorage.setItem('verizonUuid', apiSettings.verizonUuid);
    localStorage.setItem('globalUuid', apiSettings.globalUuid);
    localStorage.setItem('attUuid', apiSettings.attUuid);
    
    toast({
      title: "API settings saved",
      description: "Your API configuration has been updated successfully",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>API Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure API credentials and carrier-specific UUIDs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teal-api-key">Teal API Key</Label>
                  <Input
                    id="teal-api-key"
                    type="password"
                    value={apiSettings.tealApiKey}
                    onChange={(e) => setApiSettings(prev => ({ ...prev, tealApiKey: e.target.value }))}
                    placeholder="Enter Teal API Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teal-api-secret">Teal API Secret</Label>
                  <Input
                    id="teal-api-secret"
                    type="password"
                    value={apiSettings.tealApiSecret}
                    onChange={(e) => setApiSettings(prev => ({ ...prev, tealApiSecret: e.target.value }))}
                    placeholder="Enter Teal API Secret"
                  />
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Carrier Plan UUIDs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tmo-uuid">T-Mobile UUID</Label>
                    <Input
                      id="tmo-uuid"
                      value={apiSettings.tmoUuid}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, tmoUuid: e.target.value }))}
                      placeholder="T-Mobile plan UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verizon-uuid">Verizon UUID</Label>
                    <Input
                      id="verizon-uuid"
                      value={apiSettings.verizonUuid}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, verizonUuid: e.target.value }))}
                      placeholder="Verizon plan UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="global-uuid">Global UUID</Label>
                    <Input
                      id="global-uuid"
                      value={apiSettings.globalUuid}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, globalUuid: e.target.value }))}
                      placeholder="Global plan UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="att-uuid">AT&T UUID</Label>
                    <Input
                      id="att-uuid"
                      value={apiSettings.attUuid}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, attUuid: e.target.value }))}
                      placeholder="AT&T plan UUID"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveApiSettings} className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Save className="h-4 w-4 mr-2" />
                Save API Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
