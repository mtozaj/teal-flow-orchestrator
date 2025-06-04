
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings as SettingsIcon, Database, Bell, Shield, Save } from 'lucide-react';
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

  const [processingSettings, setProcessingSettings] = useState({
    defaultParallelism: 8,
    timeoutSeconds: 300,
    retryAttempts: 3,
    batchSize: 100
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    batchCompletionEmails: true,
    errorAlerts: true,
    weeklyReports: false
  });

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 60,
    requireMfa: false,
    auditLogging: true,
    ipWhitelisting: false
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

  const handleSaveProcessingSettings = () => {
    toast({
      title: "Processing settings saved",
      description: "Your processing configuration has been updated successfully",
    });
  };

  const handleSaveNotificationSettings = () => {
    toast({
      title: "Notification settings saved",
      description: "Your notification preferences have been updated successfully",
    });
  };

  const handleSaveSecuritySettings = () => {
    toast({
      title: "Security settings saved",
      description: "Your security configuration has been updated successfully",
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
        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="api">API Configuration</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="api">
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
          </TabsContent>

          <TabsContent value="processing">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle>Processing Configuration</CardTitle>
                <CardDescription>
                  Configure how batch processing should behave
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-parallelism">Default Parallelism</Label>
                    <Select 
                      value={processingSettings.defaultParallelism.toString()} 
                      onValueChange={(value) => setProcessingSettings(prev => ({ ...prev, defaultParallelism: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 worker</SelectItem>
                        <SelectItem value="4">4 workers</SelectItem>
                        <SelectItem value="8">8 workers</SelectItem>
                        <SelectItem value="16">16 workers</SelectItem>
                        <SelectItem value="32">32 workers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={processingSettings.timeoutSeconds}
                      onChange={(e) => setProcessingSettings(prev => ({ ...prev, timeoutSeconds: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retry-attempts">Retry Attempts</Label>
                    <Input
                      id="retry-attempts"
                      type="number"
                      value={processingSettings.retryAttempts}
                      onChange={(e) => setProcessingSettings(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">Batch Size</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      value={processingSettings.batchSize}
                      onChange={(e) => setProcessingSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProcessingSettings} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Save className="h-4 w-4 mr-2" />
                    Save Processing Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notification Preferences</span>
                </CardTitle>
                <CardDescription>
                  Configure when and how you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive email notifications for important events</p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="batch-completion">Batch Completion Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified when batches finish processing</p>
                    </div>
                    <Switch
                      id="batch-completion"
                      checked={notificationSettings.batchCompletionEmails}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, batchCompletionEmails: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="error-alerts">Error Alerts</Label>
                      <p className="text-sm text-muted-foreground">Immediate alerts for processing errors</p>
                    </div>
                    <Switch
                      id="error-alerts"
                      checked={notificationSettings.errorAlerts}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, errorAlerts: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="weekly-reports">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">Weekly summary of all batch activities</p>
                    </div>
                    <Switch
                      id="weekly-reports"
                      checked={notificationSettings.weeklyReports}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveNotificationSettings} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Save className="h-4 w-4 mr-2" />
                    Save Notification Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security Settings</span>
                </CardTitle>
                <CardDescription>
                  Configure security and access control settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="require-mfa">Require MFA</Label>
                        <p className="text-sm text-muted-foreground">Multi-factor authentication</p>
                      </div>
                      <Switch
                        id="require-mfa"
                        checked={securitySettings.requireMfa}
                        onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, requireMfa: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="audit-logging">Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">Log all user actions</p>
                      </div>
                      <Switch
                        id="audit-logging"
                        checked={securitySettings.auditLogging}
                        onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, auditLogging: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="ip-whitelisting">IP Whitelisting</Label>
                        <p className="text-sm text-muted-foreground">Restrict access by IP</p>
                      </div>
                      <Switch
                        id="ip-whitelisting"
                        checked={securitySettings.ipWhitelisting}
                        onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, ipWhitelisting: checked }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveSecuritySettings} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Save className="h-4 w-4 mr-2" />
                    Save Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
