
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings as SettingsIcon, Database, Bell, Shield, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const [apiSettings, setApiSettings] = useState({
    tealApiUrl: 'https://api.teal.com',
    attApiUrl: 'https://api.att.com',
    tmoApiUrl: 'https://api.t-mobile.com',
    verizonApiUrl: 'https://api.verizon.com',
    globalApiUrl: 'https://api.global.com'
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
                  <span>API Endpoints</span>
                </CardTitle>
                <CardDescription>
                  Configure the API endpoints for different carriers and services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teal-api">Teal API URL</Label>
                    <Input
                      id="teal-api"
                      value={apiSettings.tealApiUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, tealApiUrl: e.target.value }))}
                      placeholder="https://api.teal.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="att-api">AT&T API URL</Label>
                    <Input
                      id="att-api"
                      value={apiSettings.attApiUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, attApiUrl: e.target.value }))}
                      placeholder="https://api.att.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tmo-api">T-Mobile API URL</Label>
                    <Input
                      id="tmo-api"
                      value={apiSettings.tmoApiUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, tmoApiUrl: e.target.value }))}
                      placeholder="https://api.t-mobile.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verizon-api">Verizon API URL</Label>
                    <Input
                      id="verizon-api"
                      value={apiSettings.verizonApiUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, verizonApiUrl: e.target.value }))}
                      placeholder="https://api.verizon.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="global-api">Global API URL</Label>
                    <Input
                      id="global-api"
                      value={apiSettings.globalApiUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, globalApiUrl: e.target.value }))}
                      placeholder="https://api.global.com"
                    />
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
