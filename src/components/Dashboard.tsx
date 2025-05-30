import { useBot } from '../context/BotContext';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export const Dashboard = () => {
  const { state } = useBot();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bought': return 'success';
      case 'failed': return 'error';
      case 'buying': return 'info';
      default: return 'warning';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Token Sniper Bot</h1>
          <p className="text-sm text-gray-400 mt-1">
            Bot is controlled via backend terminal. This dashboard shows live updates only.
          </p>
        </div>
        <div className="px-4 py-2 rounded bg-gray-700">
          <span className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${state.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            Status: {state.isRunning ? 'Running' : 'Waiting for backend start'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <TableContainer component={Paper} sx={{ 
  backgroundColor: '#6A5ACD', // Slateblue - darker purple
  '& .MuiTableCell-root': {
    color: 'white',
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    fontWeight: 'bold',
    fontSize: '0.95rem',
    backgroundColor: '#483D8B', // Darkslateblue for header
    color: 'white', // Changed to white for better contrast
  }
}}>
          <h2 className="text-xl font-semibold p-4 text-white">Detected Tokens</h2>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Mint Address</TableCell>
                <TableCell>Creator</TableCell>
                <TableCell>Supply</TableCell>
                <TableCell>Bonding Curve</TableCell>
                <TableCell>Curve Token</TableCell>
                <TableCell>User Token</TableCell>
                <TableCell>Metadata</TableCell>
                <TableCell>Decimals</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.tokens.map((token, i) => (
                <TableRow 
                  key={i} 
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': { backgroundColor: '#7B68EE' } // MediumSlateBlue for hover
                  }}
                >
                  <TableCell>
                    <Chip
                      label={token.status}
                      color={getStatusColor(token.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(token.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.mint.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.mint)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.creator.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.creator)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-white">{token.supply || 'Unknown'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.bondingCurve.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.bondingCurve)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.curveTokenAccount.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.curveTokenAccount)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.userTokenAccount.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.userTokenAccount)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{token.metadata.slice(0, 8)}...</span>
                      <IconButton 
                        size="small" 
                        onClick={() => navigator.clipboard.writeText(token.metadata)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { backgroundColor: '#8A65D7' }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell>{token.decimals}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Activity Log Panel */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {state.logs.map((log, i) => (
              <div key={i} className={`p-2 rounded ${
                log.type === 'error' ? 'bg-red-900/50' :
                log.type === 'success' ? 'bg-green-900/50' :
                'bg-gray-700'
              }`}>
                <div className="text-sm opacity-75">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};