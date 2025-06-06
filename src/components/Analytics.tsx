
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent 
} from '@/components/ui/chart';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import { useAnalyticsCharts } from '@/hooks/useAnalyticsCharts';
import { TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';

const chartConfig = {
  success: {
    label: "Success",
    color: "#22c55e",
  },
  failures: {
    label: "Failures", 
    color: "#ef4444",
  },
  total: {
    label: "Total",
    color: "#3b82f6",
  },
};

const carrierColors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];

export const Analytics = () => {
  const { batchTrends, carrierStats, processingTimes } = useAnalyticsCharts();

  return (
    <div className="space-y-6">
      {/* Batch Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Batch Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <LineChart data={batchTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line 
                type="monotone" 
                dataKey="success" 
                stroke="var(--color-success)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-success)" }}
              />
              <Line 
                type="monotone" 
                dataKey="failures" 
                stroke="var(--color-failures)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-failures)" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Carrier Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={carrierStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="carrier" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="successful" fill="#22c55e" name="Successful" />
                <Bar dataKey="total" fill="#e5e7eb" name="Total" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Processing Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Processing Time Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <PieChart>
                <Pie
                  data={processingTimes}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ range, count }) => count > 0 ? `${range}: ${count}` : ''}
                >
                  {processingTimes?.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={carrierColors[index % carrierColors.length]} 
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {carrierStats?.length ? 
                    (carrierStats.reduce((sum, c) => sum + parseFloat(c.successRate), 0) / carrierStats.length).toFixed(1) 
                    : '0'}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Carriers</p>
                <p className="text-2xl font-bold text-blue-600">
                  {carrierStats?.filter(c => c.total > 0).length || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fastest Processing</p>
                <p className="text-2xl font-bold text-purple-600">
                  {processingTimes?.[0]?.range || 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
