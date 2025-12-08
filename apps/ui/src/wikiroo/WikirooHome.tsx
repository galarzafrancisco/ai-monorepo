import { useNavigate } from 'react-router-dom';

export function WikirooHome() {

  const navigate = useNavigate();

  return (
    <div className="wikiroo-welcome">
      <h2>Wikiroo</h2>
      <br />
      <button
        className="wikiroo-button primary"
        type="button"
        onClick={() => navigate('/wikiroo/new')}
        title="Create new page"
      >
        + New page
      </button>
    </div>
  );
}
